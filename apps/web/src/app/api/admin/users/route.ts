import { type AuthAccountMap, fetchAuthAccounts } from "@/app/(platform)/admin/users/auth-accounts"
import {
  areaIdsByUser,
  areaNamesByUser,
  idsMatchingDisplayStatus,
  jobRoleIdsMatching,
  parseDisplayStatusFilter,
} from "@/app/(platform)/admin/users/filters"
import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"
import { inviteTenantUser } from "./invite-user"

/* --------------------------------- Schemas -------------------------------- */

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "leader", "manager", "admin", "instructor"]),
  full_name: z.string().min(1),
  // Nome padronizado de exibição para tabelas de análise. Opcional: quando
  // ausente/vazio, fica null e as telas caem no fallback report_name ?? full_name.
  report_name: z.string().trim().min(1).nullish(),
})

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve tenant_id: admin/super_admin with null tenant uses cookie
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Nenhum tenant ativo. Selecione um tenant primeiro." },
      { status: 400 },
    )
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)
  const role = searchParams.get("role")
  const rawSearch = searchParams.get("search")
  const search = rawSearch ? rawSearch.replace(/[%_,.()]/g, "") : null

  // Cargos e áreas do tenant: alimentam a busca por cargo e as colunas Cargo/Área
  // (CFG-6.1, AC1/AC2). São as MESMAS listas que o loader da primeira página já
  // carrega — sem elas aqui, "Carregar mais" traria linhas sem essas colunas.
  const [{ data: jobRolesRaw }, { data: areasRaw }] = await Promise.all([
    supabase.from("job_roles").select("id, name").eq("tenant_id", tenantId),
    supabase.from("areas").select("id, name").eq("tenant_id", tenantId),
  ])
  const jobRoles = (jobRolesRaw ?? []) as { id: string; name: string }[]
  const areas = (areasRaw ?? []) as { id: string; name: string }[]

  // Sem `avatar_url`: a coluna não existe no banco (ver o comentário longo em
  // `admin/users/loader.ts`). Este select é o do "Carregar mais" e estava
  // falhando com `42703` exatamente como o da primeira página.
  let query = supabase
    .from("users")
    .select("id, full_name, email, role, status, created_at, reports_to, job_role_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit + 1) // fetch one extra to determine if there's a next page

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  if (role) {
    query = query.eq("role", role)
  }

  if (search) {
    // Mesma busca única da primeira página (nome, email e cargo).
    const matchedJobRoleIds = jobRoleIdsMatching(jobRoles, search)
    const clauses = [`full_name.ilike.%${search}%`, `email.ilike.%${search}%`]
    if (matchedJobRoleIds.length > 0) {
      clauses.push(`job_role_id.in.(${matchedJobRoleIds.join(",")})`)
    }
    query = query.or(clauses.join(","))
  }

  // Filtro por estado EXIBIDO (AC8). É derivado, então precisa do censo do
  // tenant + dos fatos do Auth ANTES da página — exatamente como no loader. O
  // mapa lido aqui é reaproveitado embaixo: uma leitura privilegiada por
  // requisição, nunca duas.
  const statusFilter = parseDisplayStatusFilter(searchParams.get("status"))
  let authAccounts: AuthAccountMap | null = null
  if (statusFilter) {
    const { data: rosterRaw } = await supabase
      .from("users")
      .select("id, status")
      .eq("tenant_id", tenantId)
    const roster = (rosterRaw ?? null) as { id: string; status: string }[] | null
    authAccounts = await fetchAuthAccounts((roster ?? []).map((r) => r.id))

    const allowedIds = idsMatchingDisplayStatus(roster, authAccounts, statusFilter)
    if (allowedIds === null) {
      // Não dá para honrar o filtro (Auth fora do ar). A página seguinte volta
      // SEM filtro, coerente com a primeira, que também avisa em vez de mentir.
    } else if (allowedIds.length === 0) {
      return NextResponse.json({ data: [], nextCursor: null })
    } else {
      query = query.in("id", allowedIds)
    }
  }

  // Area-scoped filtering: only return users that belong to a specific area
  const areaId = searchParams.get("area_id")
  if (areaId) {
    const { data: areaUsers } = await supabase
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaId)
    const userIds = (areaUsers ?? []).map((u) => u.user_id)
    if (userIds.length > 0) {
      query = query.in("id", userIds)
    } else {
      return NextResponse.json({ data: [], nextCursor: null })
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  // "Último acesso" (CFG-2.3) + estado do convite (CFG-2.2), na MESMA leitura.
  // Esta rota alimenta o "carregar mais" da MESMA lista servida por
  // `loadAdminUsers`; a leitura privilegiada de `auth.users` vive num accessor
  // só, para as duas não divergirem — sem isto, a página 1 mostraria a pílula de
  // convite e a página 2 não.
  const accounts = authAccounts ?? (await fetchAuthAccounts(items.map((u) => u.id)))

  // Resolve display names for the "superior imediato" (reports_to) references
  const superiorIds = [...new Set(items.map((u) => u.reports_to).filter(Boolean))] as string[]
  const superiorNameMap: Record<string, string | null> = {}
  if (superiorIds.length > 0) {
    const { data: superiors } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", superiorIds)
    for (const s of superiors ?? []) {
      superiorNameMap[s.id] = s.full_name
    }
  }

  // Cargo e Área resolvidos igual à primeira página (AC2).
  const jobRoleNameById = new Map(jobRoles.map((jr) => [jr.id, jr.name]))
  let memberships: { user_id: string; area_id: string }[] | null = null
  if (items.length > 0) {
    const { data: membershipRows } = await supabase
      .from("user_areas")
      .select("user_id, area_id")
      .in(
        "user_id",
        items.map((u) => u.id),
      )
    memberships = (membershipRows ?? null) as { user_id: string; area_id: string }[] | null
  }
  const areaNames = areaNamesByUser(memberships, areas)
  const areaIds = areaIdsByUser(memberships, areas)

  const users = items.map((u) => ({
    ...u,
    // Mesma razão do loader: não há fonte de avatar em produção.
    avatar_url: null,
    last_sign_in_at: accounts[u.id]?.last_sign_in_at ?? null,
    invited_at: accounts[u.id]?.invited_at ?? null,
    confirmed_at: accounts[u.id]?.confirmed_at ?? null,
    superior_name: u.reports_to ? (superiorNameMap[u.reports_to] ?? null) : null,
    job_role_name: u.job_role_id ? (jobRoleNameById.get(u.job_role_id) ?? null) : null,
    area_names: areaNames[u.id] ?? [],
    area_ids: areaIds[u.id] ?? [],
  }))

  return NextResponse.json({ data: users, nextCursor })
}

/* ---------------------------------- POST ---------------------------------- */

export async function POST(request: Request) {
  // 1. Verify caller is admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve tenant_id: admin/super_admin with null tenant uses cookie
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Nenhum tenant ativo. Selecione um tenant antes de convidar usuários." },
      { status: 400 },
    )
  }

  // 2. Validate body
  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  // 3. Invite via service role + 4. materializa o perfil em public.users, para a
  // pessoa aparecer na lista imediatamente. A sequência mora em `invite-user.ts`
  // porque o import em massa executa exatamente a mesma.
  const serviceClient = createServiceClient()
  const outcome = await inviteTenantUser(serviceClient, tenantId, parsed.data)

  if (!outcome.ok) {
    return outcome.stage === "invite"
      ? NextResponse.json({ error: outcome.message }, { status: 400 })
      : NextResponse.json(
          { error: `Convite enviado, mas falha ao criar perfil: ${outcome.message}` },
          { status: 500 },
        )
  }

  if (outcome.userId) {
    await logAdminAction({
      actorId: user.id,
      tenantId,
      action: "user.invited",
      targetType: "user",
      targetId: outcome.userId,
      details: { email: parsed.data.email, role: parsed.data.role },
    })
  }

  return NextResponse.json({ data: { user: { id: outcome.userId } } }, { status: 201 })
}
