// POST /api/engagement/campaign
// Engagement Center v2 (E3) — a COLLECTIVE campaign in two explicit modes
// (decision #8 of the epic: no campaign dispatches without a preview first):
//   • mode="preview"  → resolve the SCOPED recipient list + inclusion reason,
//                       send NOTHING. The manager reviews (and may remove ids).
//   • mode="confirm"  → dispatch to the explicitly-reviewed studentIds. The list
//                       is RE-SCOPED again server-side (a removed/foreign id can
//                       never slip back in), capped at MAX_RECIPIENTS.
//
// Security trava (AUTH → VALIDATE → RE-SCOPE → DISPATCH). RE-SCOPE uses
// resolveAudienceScoped (preview) / resolveEngagementScope (confirm) with the
// AUTHENTICATED client so a criteria/id set can never reach a foreign student.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveAudienceScoped } from "@/lib/notifications/audiences"
import { resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { dispatchTeamNudge } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import type { NotificationAudienceCriteria, NudgeType, SenderIdentity } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RECIPIENTS = 200 // same FinOps cap as api/analytics/manager/nudge

const NUDGE_TYPES: ReadonlySet<NudgeType> = new Set<NudgeType>([
  "never_accessed",
  "inactive",
  "no_reflection",
  "top_performer",
  "announcement",
  "custom",
  "behind_teaching_plan",
])

function sanitizeCriteria(raw: unknown): NotificationAudienceCriteria {
  const c: NotificationAudienceCriteria = {}
  if (!raw || typeof raw !== "object") return c
  const o = raw as Record<string, unknown>
  if (typeof o.risk === "string" && NUDGE_TYPES.has(o.risk as NudgeType))
    c.risk = o.risk as NudgeType
  if (typeof o.unit_id === "string" && UUID_RE.test(o.unit_id)) c.unit_id = o.unit_id
  if (typeof o.manager_group_id === "string" && UUID_RE.test(o.manager_group_id))
    c.manager_group_id = o.manager_group_id
  if (typeof o.course_id === "string" && UUID_RE.test(o.course_id)) c.course_id = o.course_id
  return c
}

export async function POST(request: Request) {
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

  // 2. VALIDATE
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { mode, criteria, nudgeType, studentIds, templateKey, message, senderIdentity } = body as {
    mode?: unknown
    criteria?: unknown
    nudgeType?: unknown
    studentIds?: unknown
    templateKey?: unknown
    message?: unknown
    senderIdentity?: unknown
  }
  if (mode !== "preview" && mode !== "confirm") {
    return NextResponse.json({ error: "mode must be preview|confirm" }, { status: 400 })
  }
  if (typeof nudgeType !== "string" || !NUDGE_TYPES.has(nudgeType as NudgeType)) {
    return NextResponse.json({ error: "Invalid nudgeType" }, { status: 400 })
  }
  const identity: SenderIdentity =
    senderIdentity === "manager" || senderIdentity === "platform"
      ? (senderIdentity as SenderIdentity)
      : "platform"

  // ----------------------------------------------------------------------
  // PREVIEW — resolve the SCOPED recipient set from criteria; send nothing.
  // ----------------------------------------------------------------------
  if (mode === "preview") {
    const safeCriteria = sanitizeCriteria(criteria)
    const recipients = await resolveAudienceScoped(supabase, tenantId, user.id, roles, safeCriteria)
    // Names for the review list (service client — a manager can read tenant users).
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const capped = recipients.slice(0, MAX_RECIPIENTS)
    const nameRows = capped.length
      ? ((
          await svc
            .from("users")
            .select("id, full_name, email")
            .eq("tenant_id", tenantId)
            .in("id", capped)
        ).data ?? [])
      : []
    const nameById = new Map(
      (nameRows as { id: string; full_name: string | null; email: string | null }[]).map((r) => [
        r.id,
        r,
      ]),
    )
    return NextResponse.json({
      mode: "preview",
      total: recipients.length,
      capped: recipients.length > MAX_RECIPIENTS,
      recipients: capped.map((id) => ({
        id,
        fullName: nameById.get(id)?.full_name ?? null,
        email: nameById.get(id)?.email ?? null,
        reason: nudgeType,
      })),
    })
  }

  // ----------------------------------------------------------------------
  // CONFIRM — dispatch to the explicitly-reviewed studentIds, RE-SCOPED again.
  // ----------------------------------------------------------------------
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: "studentIds is required for confirm" }, { status: 400 })
  }
  const requestedIds = [...new Set(studentIds)]
  if (!requestedIds.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json({ error: "studentIds must be UUIDs" }, { status: 400 })
  }
  if (requestedIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 },
    )
  }
  if (templateKey !== undefined && templateKey !== null && typeof templateKey !== "string") {
    return NextResponse.json({ error: "templateKey must be a string" }, { status: 400 })
  }
  if (message !== undefined && message !== null && typeof message !== "string") {
    return NextResponse.json({ error: "message must be a string" }, { status: 400 })
  }

  // 3. RE-SCOPE — the reviewed list is filtered to the caller's reach again.
  const allowedStudentIds = await resolveEngagementScope(supabase, tenantId, user.id, roles)
  const safeIds =
    allowedStudentIds === null
      ? (requestedIds as string[])
      : (requestedIds as string[]).filter((id) => new Set(allowedStudentIds).has(id))
  const droppedOutsideScope = requestedIds.length - safeIds.length
  if (safeIds.length === 0) {
    return NextResponse.json(
      { error: "No recipients within your scope", recipientsSkipped: droppedOutsideScope },
      { status: 400 },
    )
  }

  // 4. DISPATCH — senderName server-trusted when manager identity.
  const senderName =
    identity === "manager" ? ((profile as { full_name?: string | null }).full_name ?? null) : null
  try {
    const result = await dispatchTeamNudge({
      tenantId,
      studentIds: safeIds,
      nudgeType: nudgeType as NudgeType,
      templateKey: typeof templateKey === "string" ? templateKey : null,
      message: typeof message === "string" ? message : null,
      courseId: null,
      originManagerId: user.id,
      senderIdentity: identity,
      senderName,
    })
    return NextResponse.json({
      mode: "confirm",
      inAppCreated: result.inAppCreated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      recipientsSkipped: droppedOutsideScope + result.recipientsSkipped,
      total: result.total,
    })
  } catch (err) {
    console.error("[engagement/campaign] dispatch error:", err)
    const messageText = err instanceof Error ? err.message : "Failed to dispatch campaign"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
