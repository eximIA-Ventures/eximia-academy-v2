// GET /api/engagement/history
// Engagement Center v2 (E3) — the SENT history, scoped to the manager's recorte.
// Never returns a row whose recipient_id is outside the caller's reach.
//
// Query filters (all optional): student, type (nudgeType via context.nudge_type),
// origin (nudge|manual|system), channel (inapp|email), status, from, to (ISO dates).
//
// Security trava (AUTH → RE-SCOPE → QUERY). The recipient_id IN (allowedStudentIds)
// filter IS the non-leakage guarantee; an admin (null scope) is tenant-wide.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ROWS = 200
const RECIPIENT_CHUNK = 200

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

  // 2. RE-SCOPE
  const allowedStudentIds = await resolveEngagementScope(supabase, tenantId, user.id, roles)
  // Scoped caller with no reachable students → empty history (fail-closed).
  if (allowedStudentIds !== null && allowedStudentIds.length === 0) {
    return NextResponse.json({ notifications: [] })
  }

  // 3. QUERY — parse filters + build the scoped read.
  const url = new URL(request.url)
  const qStudent = url.searchParams.get("student")
  const qOrigin = url.searchParams.get("origin")
  const qChannel = url.searchParams.get("channel")
  const qStatus = url.searchParams.get("status")
  const qFrom = url.searchParams.get("from")
  const qTo = url.searchParams.get("to")

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
        "id, recipient_id, template_id, channel, origin, title, body, status, sender_identity, sender_name, context, created_at, sent_at, read_at",
      )
      .eq("tenant_id", tenantId)
    if (chunk != null) q = q.in("recipient_id", chunk)
    if (qOrigin === "nudge" || qOrigin === "manual" || qOrigin === "system")
      q = q.eq("origin", qOrigin)
    if (qChannel === "inapp" || qChannel === "email") q = q.eq("channel", qChannel)
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

  return NextResponse.json({ notifications: rows })
}
