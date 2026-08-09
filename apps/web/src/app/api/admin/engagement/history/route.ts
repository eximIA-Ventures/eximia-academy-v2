// GET /api/admin/engagement/history
// Returns the last N notifications (all channels, admin view) with recipient info
// and efficacy (returned_at), plus per-type efficacy stats.
// Query params: limit (default 50, max 200), origin (optional filter).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveCallerStudentScope } from "@/lib/area-context"
import { nudgeEfficacyByType, type NudgeEfficacyByType } from "@/lib/notifications/efficacy"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { Role } from "@eximia/shared"
import { NextResponse } from "next/server"

const ENGAGEMENT_READ_ROLES: Role[] = ["admin", "manager", "instructor"]
const HISTORY_SELECT =
  "id, recipient_id, template_id, channel, origin, title, status, created_at, sent_at, read_at, acted_at, returned_at"
const SCOPED_EFFICACY_MAX_ROWS = 50_000
const SCOPED_EFFICACY_PAGE_SIZE = 1000

type ServiceClient = ReturnType<typeof createServiceClient>

interface MetricRow {
  template_id: string | null
  returned_at: string | null
}

async function fetchScopedRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows: number,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (let page = 0; page < 100; page++) {
    const to = Math.min(from + SCOPED_EFFICACY_PAGE_SIZE - 1, maxRows - 1)
    if (to < from) break
    const { data, error } = await buildPage(from, to)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < SCOPED_EFFICACY_PAGE_SIZE || all.length >= maxRows) break
    from += SCOPED_EFFICACY_PAGE_SIZE
  }
  return all
}

async function nudgeEfficacyByTypeForRecipients(
  tenantId: string,
  recipientIds: string[],
  db: ServiceClient,
): Promise<NudgeEfficacyByType[]> {
  if (recipientIds.length === 0) return []

  const rows = await fetchScopedRows<MetricRow>(
    (from, to) =>
      db
        .from("notifications")
        .select("template_id, returned_at")
        .eq("tenant_id", tenantId)
        .eq("origin", "nudge")
        .eq("channel", "inapp")
        .not("sent_at", "is", null)
        .in("recipient_id", recipientIds)
        .range(from, to),
    SCOPED_EFFICACY_MAX_ROWS,
  )
  if (rows.length === 0) return []

  const templateIds = [...new Set(rows.map((r) => r.template_id).filter((t): t is string => !!t))]
  const keyById = new Map<string, string>()
  if (templateIds.length > 0) {
    const templates = await fetchScopedRows<{ id: string; key: string }>(
      (from, to) =>
        db
          .from("notification_templates")
          .select("id, key")
          .eq("tenant_id", tenantId)
          .in("id", templateIds)
          .range(from, to),
      templateIds.length,
    )
    for (const template of templates) keyById.set(template.id, template.key)
  }

  const agg = new Map<string, { sent: number; returned: number }>()
  for (const row of rows) {
    const key = row.template_id ? (keyById.get(row.template_id) ?? "") : ""
    const entry = agg.get(key) ?? { sent: 0, returned: 0 }
    entry.sent += 1
    if (row.returned_at) entry.returned += 1
    agg.set(key, entry)
  }

  return [...agg.entries()]
    .map(([key, { sent, returned }]) => ({
      templateKey: key === "" ? null : key,
      sent,
      returned,
      returnRatePct: sent > 0 ? Math.round((returned / sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
}

export async function GET(request: Request) {
  const { user, profile, supabase, roles } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasAnyRole({ roles }, ENGAGEMENT_READ_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const url = new URL(request.url)
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "50")
  const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 50 : limitRaw, 1), 200)
  const originFilter = url.searchParams.get("origin")

  const db = createServiceClient()
  const scope = await resolveCallerStudentScope(supabase, tenantId, user.id, roles)

  if (scope?.length === 0) {
    return NextResponse.json({ notifications: [], efficacy: [] })
  }

  // Notifications query (admin reads all channels for their tenant).
  let query = db
    .from("notifications")
    .select(HISTORY_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (scope) {
    query = query.in("recipient_id", scope)
  }

  if (originFilter && ["nudge", "manual", "system"].includes(originFilter)) {
    query = query.eq("origin", originFilter)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error("[engagement/history GET]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with recipient display name (bulk join in memory — max 200 rows).
  const recipientIds = [
    ...new Set((rows ?? []).map((r: { recipient_id: string }) => r.recipient_id)),
  ]
  const recipientMap: Record<string, { full_name: string | null; email: string | null }> = {}
  if (recipientIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .in("id", recipientIds)
    for (const u of users ?? []) {
      recipientMap[u.id as string] = {
        full_name: u.full_name as string | null,
        email: u.email as string | null,
      }
    }
  }

  const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    recipient_name: recipientMap[r.recipient_id as string]?.full_name ?? null,
    recipient_email: recipientMap[r.recipient_id as string]?.email ?? null,
  }))

  const efficacy = scope
    ? await nudgeEfficacyByTypeForRecipients(tenantId, scope, db)
    : await nudgeEfficacyByType(tenantId, db)

  return NextResponse.json({ notifications: enriched, efficacy })
}
