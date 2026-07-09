// GET /api/engagement/history
// Engagement Center v2 (E3) — the SENT history, scoped to the manager's recorte.
// Never returns a row whose recipient_id is outside the caller's reach.
//
// Query filters (all optional): student, type (nudgeType via context.nudge_type),
// origin (nudge|manual|system), channel, status, from, to (ISO dates).
//   channel: DEFAULTS to "inapp" (matches the "Mensagens enviadas" summary card,
//   E12 item 2). Pass `?channel=email` for e-mails only, or `?channel=all` for
//   every channel.
//
// Security trava (AUTH → RE-SCOPE → QUERY). The recipient_id IN (allowedStudentIds)
// filter IS the non-leakage guarantee; an admin (null scope) is tenant-wide.
//
// Enrichment: rows carry recipient_name/recipient_email resolved via a bulk lookup
// over `users` (same pattern as admin/notifications/page.tsx). The lookup is bounded
// to recipient ids that ALREADY appear in the scoped rows — it can never surface a
// name for a student outside the caller's reach (the read is already scope-filtered).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { NudgeType } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ROWS = 200
const RECIPIENT_CHUNK = 200

// The action/nudge types that may appear in context.nudge_type. Mirrors the
// NudgeType union; an unknown `type` param is rejected (400) rather than passed
// raw to the DB filter.
const NUDGE_TYPES: ReadonlySet<string> = new Set<NudgeType>([
  "never_accessed",
  "inactive",
  "no_reflection",
  "top_performer",
  "announcement",
  "custom",
  "behind_teaching_plan",
])

export async function GET(request: Request) {
  // 1. AUTH
  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  // 2. RE-SCOPE — Rodada 3: honour the drill-down `?focus=` so the history table
  // reflects the SAME node the /engagement page shows.
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    readFocusParam(request),
  )
  // Scoped caller with no reachable students → empty history (fail-closed).
  if (allowedStudentIds !== null && allowedStudentIds.length === 0) {
    return NextResponse.json({ notifications: [] })
  }

  // 3. QUERY — parse filters + build the scoped read.
  const url = new URL(request.url)
  const qStudent = url.searchParams.get("student")
  const qType = url.searchParams.get("type")
  const qOrigin = url.searchParams.get("origin")
  const qChannel = url.searchParams.get("channel")
  const qStatus = url.searchParams.get("status")
  const qFrom = url.searchParams.get("from")
  const qTo = url.searchParams.get("to")

  // The `type` filter targets the action/nudge type stored in context.nudge_type.
  // Reject an unknown type up front (never hand a raw string to the DB filter).
  if (qType && !NUDGE_TYPES.has(qType)) {
    return NextResponse.json({ error: "unknown type" }, { status: 400 })
  }

  const svc = createServiceClient()

  // If a specific student filter is given, it must be within scope.
  if (qStudent) {
    if (!UUID_RE.test(qStudent)) {
      return NextResponse.json({ error: "student must be a UUID" }, { status: 400 })
    }
    if (allowedStudentIds !== null && !new Set(allowedStudentIds).has(qStudent)) {
      return NextResponse.json({ notifications: [] }) // outside scope → empty, never leak
    }
  }

  // The recipient set the read is bounded to. When a student filter is given,
  // it's that single id (already scope-checked); otherwise the whole scope.
  const recipientBound: string[] | null = qStudent
    ? [qStudent]
    : (allowedStudentIds as string[] | null)

  // Chunk the recipient filter to stay under the URL cap; merge + sort + cap.
  const chunks: (string[] | null)[] =
    recipientBound === null
      ? [null]
      : Array.from({ length: Math.ceil(recipientBound.length / RECIPIENT_CHUNK) }, (_, i) =>
          recipientBound.slice(i * RECIPIENT_CHUNK, (i + 1) * RECIPIENT_CHUNK),
        )

  const collected: Record<string, unknown>[] = []
  for (const chunk of chunks) {
    let q = svc
      .from("notifications")
      .select(
        "id, recipient_id, template_id, channel, origin, title, body, status, sender_identity, sender_name, context, created_at, sent_at, read_at, returned_at, acted_at",
      )
      .eq("tenant_id", tenantId)
    if (chunk != null) q = q.in("recipient_id", chunk)
    // `type` → filter on the JSONB context.nudge_type (no join; the type lives in
    // the row's own context payload). Validated against NUDGE_TYPES above.
    if (qType) q = q.eq("context->>nudge_type", qType)
    if (qOrigin === "nudge" || qOrigin === "manual" || qOrigin === "system")
      q = q.eq("origin", qOrigin)
    // CHANNEL DEFAULT (E12 item 2): the "Mensagens enviadas" summary card counts
    // ONLY in-app notifications (overview/route.ts + page.tsx both `.eq(channel,
    // inapp)`, sublabel "in-app neste recorte"). To keep the Histórico total
    // consistent with that card, this route DEFAULTS to `channel = "inapp"` when no
    // channel is requested. Explicit overrides: `?channel=email` for e-mails only,
    // or `?channel=all` to see every channel (the old unfiltered behaviour).
    if (qChannel === "inapp" || qChannel === "email") {
      q = q.eq("channel", qChannel)
    } else if (qChannel !== "all") {
      // No channel param (or an unrecognised one) → default to in-app, matching
      // the summary card's single source of truth.
      q = q.eq("channel", "inapp")
    }
    if (qStatus && ["queued", "sent", "read", "acted"].includes(qStatus))
      q = q.eq("status", qStatus)
    if (qFrom) q = q.gte("created_at", qFrom)
    if (qTo) q = q.lte("created_at", qTo)
    q = q.order("created_at", { ascending: false }).limit(MAX_ROWS)
    const { data } = await q
    collected.push(...((data ?? []) as Record<string, unknown>[]))
  }

  const rows = collected
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, MAX_ROWS)

  // Enrich with recipient names (bulk lookup over `users`, mirroring
  // admin/notifications/page.tsx). SECURITY: the ids come EXCLUSIVELY from the
  // scoped rows above (recipient_id ∈ allowedStudentIds already), so this can
  // never resolve a name for a student outside the caller's reach.
  const recipientIds = [...new Set(rows.map((r) => r.recipient_id as string))]
  const recipientMap: Record<string, { full_name: string | null; email: string | null }> = {}
  if (recipientIds.length > 0) {
    const { data: usersData } = await svc
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .in("id", recipientIds)
    for (const u of (usersData ?? []) as Array<{
      id: string
      full_name: string | null
      email: string | null
    }>) {
      recipientMap[u.id] = { full_name: u.full_name, email: u.email }
    }
  }

  const notifications = rows.map((r) => ({
    ...r,
    recipient_name: recipientMap[r.recipient_id as string]?.full_name ?? null,
    recipient_email: recipientMap[r.recipient_id as string]?.email ?? null,
  }))

  return NextResponse.json({ notifications })
}
