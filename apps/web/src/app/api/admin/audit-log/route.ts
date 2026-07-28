import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_PERIODS = new Set([1, 7, 30, 90])
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
// CSV export is uncapped by pagination but bounded to keep the response sane
const CSV_MAX_ROWS = 5000

interface ActorInfo {
  id: string
  full_name: string | null
  email: string | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Resolve tenant_id: super_admin with null tenant uses the active-tenant cookie
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

  const periodRaw = Number(searchParams.get("period") ?? "30")
  const period = VALID_PERIODS.has(periodRaw) ? periodRaw : 30

  const type = searchParams.get("type")
  const userFilter = searchParams.get("user")
  if (userFilter && !UUID_RE.test(userFilter)) {
    return NextResponse.json({ error: "Parâmetro user inválido (uuid esperado)" }, { status: 400 })
  }

  const format = searchParams.get("format")
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const pageSize = Math.min(
    Math.max(
      1,
      Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    ),
    MAX_PAGE_SIZE,
  )

  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()

  // platform_audit_log has no tenant_id column — the scope lives in details.tenant_id
  const service = createServiceClient()
  let query = service
    .from("platform_audit_log")
    .select("id, actor_id, action, target_type, target_id, details, created_at", {
      count: "exact",
    })
    .eq("details->>tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })

  if (type) query = query.eq("target_type", type)
  if (userFilter) {
    // Matches the actor OR the target when the target is a user
    query = query.or(
      `actor_id.eq.${userFilter},and(target_id.eq.${userFilter},target_type.eq.user)`,
    )
  }

  if (format === "csv") {
    query = query.limit(CSV_MAX_ROWS)
  } else {
    query = query.range((page - 1) * pageSize, page * pageSize - 1)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // Resolve actor names in one extra query (no FK join on platform_audit_log)
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))]
  const actorsById = new Map<string, ActorInfo>()
  if (actorIds.length > 0) {
    const { data: actors } = await service
      .from("users")
      .select("id, full_name, email")
      .in("id", actorIds)
    for (const actor of actors ?? []) actorsById.set(actor.id, actor)
  }

  const enriched = rows.map((row) => {
    const details = (row.details ?? {}) as Record<string, unknown>
    return {
      ...row,
      actor: actorsById.get(row.actor_id) ?? null,
      ip: typeof details.ip === "string" ? details.ip : null,
    }
  })

  if (format === "csv") {
    const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const header = ["quando", "acao", "autor", "tipo", "alvo", "ip", "detalhes"].join(",")
    const lines = enriched.map((row) =>
      [
        row.created_at,
        row.action,
        row.actor ? `${row.actor.full_name ?? ""} <${row.actor.email ?? ""}>` : row.actor_id,
        row.target_type,
        row.target_id,
        row.ip ?? "",
        JSON.stringify(row.details ?? {}),
      ]
        .map(esc)
        .join(","),
    )
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-log.csv"',
      },
    })
  }

  return NextResponse.json({ data: enriched, page, pageSize, total: count ?? 0 })
}
