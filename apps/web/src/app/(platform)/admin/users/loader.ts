import type { AreaData } from "@/components/providers/area-provider"
import { getAuthProfile, getDbClient, resolveTenantId } from "@/lib/auth"
import { deriveUserDisplayStatus, isPendingInvite } from "@/lib/invites/status"
import { type AuthAccountMap, fetchAuthAccounts } from "./auth-accounts"
import {
  type DisplayStatusFilter,
  areaIdsByUser,
  areaNamesByUser,
  idsMatchingDisplayStatus,
  jobRoleIdsMatching,
  parseDisplayStatusFilter,
} from "./filters"

/**
 * Loader único da tela de Usuários (filtros + paginação por cursor + áreas +
 * cargos + contadores).
 *
 * Extraído de `admin/users/page.tsx` para que a rota antiga (`/admin/users`,
 * que segue viva) e a seção do hub (`/admin/configuracoes/usuarios`) leiam pela
 * MESMA query. Comportamento preservado byte a byte, inclusive o curto-circuito
 * do filtro de área: quando a área não tem ninguém, a lista volta vazia e os
 * contadores NÃO são consultados (`stats: null`), exatamente como antes.
 */

export interface AdminUserRow {
  id: string
  full_name: string | null
  email: string
  role: string
  status: string
  avatar_url: string | null
  created_at: string
  reports_to: string | null
  job_role_id: string | null
  last_sign_in_at: string | null
  superior_name: string | null
  /**
   * Fatos do Supabase Auth (CFG-2.2). `null` significa "o Auth não respondeu"
   * OU "não há convite" — nos dois casos a derivação cai no par binário
   * Ativo/Inativo, que é o comportamento anterior a esta story.
   */
  invited_at: string | null
  confirmed_at: string | null
  /** Nome do cargo resolvido a partir de `job_role_id` (CFG-6.1, AC2). */
  job_role_name: string | null
  /** Nomes das áreas a que a pessoa pertence (CFG-6.1, AC2). */
  area_names: string[]
  /** Ids das mesmas áreas — o "Mover de área" precisa deles (CFG-6.1, AC6). */
  area_ids: string[]
}

export interface AdminUsersData {
  currentUserId: string
  areas: AreaData[]
  jobRoles: { id: string; name: string }[]
  users: AdminUserRow[]
  cursor: string | null
  search: string
  roleFilter: string
  areaFilter: string
  /** Filtro por estado EXIBIDO, vindo do clique num card do topo (AC8). */
  statusFilter: DisplayStatusFilter | null
  /**
   * `true` quando o filtro de estado foi pedido mas NÃO pôde ser honrado (o Auth
   * não respondeu). A tela avisa em vez de mostrar uma lista plausível e errada.
   */
  statusFilterUnavailable: boolean
  /**
   * Mensagem do banco quando a LEITURA DA LISTA falhou e o censo tem gente.
   * Existe para tornar impossível o defeito de 2026-07-28: contador dizendo 51 e
   * tabela dizendo "Nenhum usuário encontrado". Lista vazia só pode ser exibida
   * como "não há ninguém" quando realmente não há.
   */
  listError: string | null
  /** `null` quando o filtro de área não retornou ninguém (contadores não são lidos). */
  stats: {
    total: number
    active: number
    admins: number
    /**
     * Convites pendentes + expirados (CFG-2.2, AC6). `null`, e nunca `0`,
     * quando o estado de convite não pôde ser lido — "não sei" não pode ser
     * exibido como "nenhum".
     */
    pendingInvites: number | null
  } | null
}

export type AdminUsersLoad = { kind: "unauthenticated" } | { kind: "ok"; data: AdminUsersData }

export async function loadAdminUsers(
  params: Record<string, string | string[] | undefined>,
): Promise<AdminUsersLoad> {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return { kind: "unauthenticated" }

  // Correção de auditoria (rodada 4). Este loader NÃO usava `resolveTenantId`:
  // ele reimplementava a mesma cascata à mão (tenant próprio -> cookie
  // `x-sa-active-tenant` -> primeiro tenant do banco). O resultado era o certo
  // no caminho feliz, mas com duas arestas próprias:
  //   - o último fallback lia `tenants` pelo client SOB RLS, e não pelo service
  //     client. Para o `super_admin` isso funciona por acidente feliz (a
  //     política `super_admin_all_tenants`,
  //     `20260209000000_epic11_super_admin_whitelabel.sql:63-66`); para um
  //     `admin` de tenant nulo, `tenants_select` (`id = auth_tenant_id()`)
  //     devolveria zero linhas e a tela inteira ficaria vazia;
  //   - uma quarta cópia da mesma regra é uma quarta chance de as cópias
  //     divergirem — foi exatamente assim que `settings/loader.ts` ficou para
  //     trás e virou um beco morto.
  // O comportamento de quem TEM tenant próprio é byte-idêntico: as duas
  // primeiras linhas de `resolveTenantId` são `if (profileTenantId) return
  // profileTenantId`, sem tocar em cookie nem em service client.
  const tenantId = await resolveTenantId(profile.tenant_id)

  // Service client SÓ para quem não tem tenant próprio (admin global /
  // super_admin), exatamente como a versão manual anterior.
  const dbClient = await getDbClient()

  const search = typeof params.search === "string" ? params.search : undefined
  const roleFilter = typeof params.role === "string" ? params.role : undefined
  const areaFilter = typeof params.area_id === "string" ? params.area_id : undefined
  const statusFilter = parseDisplayStatusFilter(params.status)

  // Fetch tenant areas for the area filter dropdown
  const { data: areasRaw } = await dbClient
    .from("areas")
    .select("id, name, slug")
    .eq("tenant_id", tenantId)
    .order("name")
  const areas: AreaData[] = (areasRaw ?? []).map((a) => ({ id: a.id, name: a.name, slug: a.slug }))

  // Fetch tenant job roles for the user profile dialog (Cargo select)
  const { data: jobRolesRaw } = await dbClient
    .from("job_roles")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name")
  const jobRoles = (jobRolesRaw ?? []).map((jr) => ({ id: jr.id, name: jr.name }))

  const base = {
    currentUserId: user.id,
    areas,
    jobRoles,
    search: search ?? "",
    roleFilter: roleFilter ?? "",
    areaFilter: areaFilter ?? "",
    statusFilter,
  }

  // Censo do tenant: id + status de TODO mundo, e nada além disso. Serve a três
  // propósitos e por isso vem ANTES da página:
  //   1. os contadores do topo (CFG-2.2, AC6) precisam do tenant inteiro, não só
  //      da página de 20 — "Convites pendentes" que só contasse a primeira
  //      página seria um número errado com cara de certo;
  //   2. pedir o Auth UMA vez para a união (censo ⊇ página) evita a segunda
  //      varredura paginada que aquele AC proíbe;
  //   3. o filtro por estado EXIBIDO (CFG-6.1, AC8) é derivado, não existe
  //      `WHERE` que o expresse — ele precisa do censo derivado em memória
  //      ANTES de montar a query da página.
  const { data: rosterRaw } = await dbClient
    .from("users")
    .select("id, status")
    .eq("tenant_id", tenantId)
  const roster = (rosterRaw ?? null) as { id: string; status: string }[] | null

  // "Último acesso" (CFG-2.3) + estado do convite (CFG-2.2) na MESMA chamada:
  // os dois saem do mesmo objeto do GoTrue. O dado vive em `auth.users`, só
  // alcançável pelo service role — ver `auth-accounts.ts`. Falha ali devolve
  // mapa vazio: a coluna volta a "—", a pílula volta ao par binário e o contador
  // de convites vira `null`, sem derrubar a tela (CFG-2.2, AC9).
  //
  // Uma chamada só, sempre: com censo, ele já cobre a página (mesmo tenant); sem
  // censo, a chamada acontece uma vez depois da página, no caminho degradado.
  let authAccounts: AuthAccountMap = roster ? await fetchAuthAccounts(roster.map((r) => r.id)) : {}

  // Fetch initial page of users
  //
  // `avatar_url` NÃO entra neste select: a coluna não existe no banco
  // (introspecção de produção, 2026-07-28 — `users` tem `profile`, não
  // `avatar_url`; nenhuma migration em `supabase/migrations/` a cria, ela só
  // existe no schema do git). Pedi-la fazia o PostgREST devolver `42703`, o
  // `data` vinha `null` e a tela dizia "Nenhum usuário encontrado" sobre 51
  // pessoas reais — enquanto os contadores, que só pedem `id`/`id, status`,
  // seguiam certos. O campo continua na LINHA (como `null`) porque a UI o
  // consome; o que sai é o pedido ao banco.
  let query = dbClient
    .from("users")
    .select("id, full_name, email, role, status, created_at, reports_to, job_role_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(21) // 20 + 1 to detect next page

  if (roleFilter) {
    query = query.eq("role", roleFilter)
  }
  if (search) {
    // Busca única cobrindo nome, email e CARGO (AC1). O cargo não é texto na
    // linha do usuário, é FK: os ids que casam saem dos cargos já carregados
    // acima e entram no mesmo `.or()`. Sem casar nenhum, a cláusula não entra —
    // um `in.()` vazio é sintaxe inválida no PostgREST.
    const matchedJobRoleIds = jobRoleIdsMatching(jobRoles, search)
    const clauses = [`full_name.ilike.%${search}%`, `email.ilike.%${search}%`]
    if (matchedJobRoleIds.length > 0) {
      clauses.push(`job_role_id.in.(${matchedJobRoleIds.join(",")})`)
    }
    query = query.or(clauses.join(","))
  }

  // Area-scoped filtering at SSR level
  if (areaFilter) {
    const { data: areaUsers } = await dbClient
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaFilter)
    const userIds = (areaUsers ?? []).map((u) => u.user_id)
    if (userIds.length > 0) {
      query = query.in("id", userIds)
    } else {
      // No users in this area — skip query, return empty
      return {
        kind: "ok",
        data: {
          ...base,
          users: [],
          cursor: null,
          stats: null,
          statusFilterUnavailable: false,
          listError: null,
        },
      }
    }
  }

  // Filtro por estado EXIBIDO (AC8): derivado do censo, aplicado como `.in`,
  // exatamente o mesmo mecanismo do filtro de área acima.
  let statusFilterUnavailable = false
  let noneMatchStatus = false
  if (statusFilter) {
    const allowedIds = idsMatchingDisplayStatus(roster, authAccounts, statusFilter)
    if (allowedIds === null) {
      // Não dá para honrar o pedido (censo ausente ou Auth fora do ar). A lista
      // volta SEM filtro e com aviso: filtrar no escuro devolveria um conjunto
      // plausível e errado, e uma lista vazia leria como "não há ninguém assim".
      statusFilterUnavailable = true
    } else if (allowedIds.length === 0) {
      // Ninguém casa. `.in("id", [])` é sintaxe inválida no PostgREST, então a
      // página é pulada — mas os contadores do topo CONTINUAM sendo calculados,
      // porque são justamente eles que permitem desfazer o filtro.
      noneMatchStatus = true
    } else {
      query = query.in("id", allowedIds)
    }
  }

  const pageResult = noneMatchStatus ? null : await query
  const usersRaw = pageResult?.data ?? []

  // A leitura da página FALHOU e não é o caso de "não há ninguém": engolir isso
  // é o que transformou um erro de schema numa afirmação falsa na tela
  // ("Nenhum usuário encontrado" sobre 51 pessoas). Quando o censo tem gente e a
  // lista volta vazia, o loader é obrigado a declarar a falha — a tela mostra
  // erro, nunca vazio silencioso.
  const listError = pageResult?.error && (roster?.length ?? 0) > 0 ? pageResult.error.message : null

  // Resolve display names for the "superior imediato" (reports_to) references
  const superiorIds = [
    ...new Set((usersRaw ?? []).map((u) => u.reports_to).filter(Boolean)),
  ] as string[]
  const superiorNameMap: Record<string, string | null> = {}
  if (superiorIds.length > 0) {
    const { data: superiors } = await dbClient
      .from("users")
      .select("id, full_name")
      .in("id", superiorIds)
    for (const s of superiors ?? []) {
      superiorNameMap[s.id] = s.full_name
    }
  }

  // Caminho degradado: sem censo (a query do tenant inteiro falhou), o Auth
  // ainda é lido UMA vez, agora só para os ids da página.
  const pageIds = usersRaw.map((u) => u.id)
  if (!roster) {
    authAccounts = await fetchAuthAccounts(pageIds)
  }
  const authIds = roster ? roster.map((r) => r.id) : pageIds
  const authAvailable = authIds.length === 0 || Object.keys(authAccounts).length > 0

  // Cargo e Área como colunas de verdade (AC2). O cargo sai do mapa já carregado
  // (nenhuma query nova); as áreas saem de UMA leitura de `user_areas` para os
  // ids da página, e os nomes são resolvidos contra as áreas DO TENANT — um
  // vínculo apontando para fora dele é descartado, nunca renderizado.
  const jobRoleNameById = new Map(jobRoles.map((jr) => [jr.id, jr.name]))
  let memberships: { user_id: string; area_id: string }[] | null = null
  if (pageIds.length > 0) {
    const { data: membershipRows } = await dbClient
      .from("user_areas")
      .select("user_id, area_id")
      .in("user_id", pageIds)
    memberships = (membershipRows ?? null) as { user_id: string; area_id: string }[] | null
  }
  const areaNames = areaNamesByUser(memberships, areas)
  const areaIds = areaIdsByUser(memberships, areas)

  const allUsers: AdminUserRow[] = usersRaw.map((u) => ({
    ...u,
    // Sempre `null`: não existe fonte de avatar em produção (o jsonb `profile`
    // guarda só `ai_learning_profile` e `employee_status`). O componente cai na
    // inicial do nome, que é o comportamento que a tela já tinha de fato.
    avatar_url: null,
    last_sign_in_at: authAccounts[u.id]?.last_sign_in_at ?? null,
    invited_at: authAccounts[u.id]?.invited_at ?? null,
    confirmed_at: authAccounts[u.id]?.confirmed_at ?? null,
    superior_name: u.reports_to ? (superiorNameMap[u.reports_to] ?? null) : null,
    job_role_name: u.job_role_id ? (jobRoleNameById.get(u.job_role_id) ?? null) : null,
    area_names: areaNames[u.id] ?? [],
    area_ids: areaIds[u.id] ?? [],
  }))
  const hasMore = allUsers.length > 20
  const users = hasMore ? allUsers.slice(0, 20) : allUsers
  const cursor = hasMore ? (users[users.length - 1]?.created_at ?? null) : null

  // Stats (count queries within same tenant)
  const { count: totalCount } = await dbClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  // "Ativos" e "Convites pendentes" saem do censo em memória, não de um
  // `count(*)` novo (AC6). O `count` antigo (`.eq("status", "active")`) contava
  // como ativo quem nunca abriu o e-mail de convite — a linha nasce
  // `status: 'active'` no mesmo request do convite (`api/admin/users/route.ts`),
  // origem da contagem inflada medida em `convites-desenho.md` §3.5.
  //
  // Sem censo (query falhou) o cálculo em memória seria uma mentira menor porém
  // ainda mentira, então o caminho de trás continua sendo o `count(*)` binário.
  let activeCount: number
  let pendingInvites: number | null = null

  if (roster) {
    const derived = roster.map((r) =>
      deriveUserDisplayStatus({
        status: r.status,
        invited_at: authAccounts[r.id]?.invited_at ?? null,
        confirmed_at: authAccounts[r.id]?.confirmed_at ?? null,
      }),
    )
    activeCount = derived.filter((s) => s === "active").length
    // `null` (e não `0`) quando o Auth não respondeu: "não sei quantos" não pode
    // ser exibido como "nenhum" (AC9).
    pendingInvites = authAvailable ? derived.filter(isPendingInvite).length : null
  } else {
    const { count } = await dbClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active")
    activeCount = count ?? 0
  }

  const { count: adminCount } = await dbClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "admin")

  return {
    kind: "ok",
    data: {
      ...base,
      users,
      cursor,
      statusFilterUnavailable,
      listError,
      stats: {
        total: totalCount ?? 0,
        active: activeCount,
        admins: adminCount ?? 0,
        pendingInvites,
      },
    },
  }
}
