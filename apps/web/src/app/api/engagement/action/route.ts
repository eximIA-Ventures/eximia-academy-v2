// POST /api/engagement/action
// Engagement Center v2 (E3) — an INDIVIDUAL action to ONE student
// (remind / activate / recognize / manual). Security trava, same order as
// api/analytics/manager/nudge/route.ts:
//   1. AUTH     — getAuthProfile; admin/manager/instructor only. tenant server-side.
//   2. VALIDATE — studentId UUID, nudgeType in enum, senderIdentity in enum.
//   3. RE-SCOPE — resolveEngagementScope confirms studentId ∈ caller reach;
//                 anything outside → 403 (never dispatch silently).
//   4. DISPATCH — dispatchTeamNudge for the single recipient. senderName, when
//                 identity=manager, is the AUTHENTICATED caller's name, NEVER a
//                 client-supplied string (prevents signing as someone else).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { dispatchTeamNudge } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import type { NudgeType, SenderIdentity } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NUDGE_TYPES: ReadonlySet<NudgeType> = new Set<NudgeType>([
  "never_accessed",
  "inactive",
  "no_reflection",
  "top_performer",
  "announcement",
  "custom",
  "behind_teaching_plan",
])

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
  const { studentId, nudgeType, templateKey, message, courseId, senderIdentity } = body as {
    studentId?: unknown
    nudgeType?: unknown
    templateKey?: unknown
    message?: unknown
    courseId?: unknown
    senderIdentity?: unknown
  }

  if (typeof studentId !== "string" || !UUID_RE.test(studentId)) {
    return NextResponse.json({ error: "studentId must be a UUID" }, { status: 400 })
  }
  if (typeof nudgeType !== "string" || !NUDGE_TYPES.has(nudgeType as NudgeType)) {
    return NextResponse.json({ error: "Invalid nudgeType" }, { status: 400 })
  }
  if (templateKey !== undefined && templateKey !== null && typeof templateKey !== "string") {
    return NextResponse.json({ error: "templateKey must be a string" }, { status: 400 })
  }
  if (message !== undefined && message !== null && typeof message !== "string") {
    return NextResponse.json({ error: "message must be a string" }, { status: 400 })
  }
  if (courseId !== undefined && courseId !== null) {
    if (typeof courseId !== "string" || !UUID_RE.test(courseId)) {
      return NextResponse.json({ error: "courseId must be a UUID" }, { status: 400 })
    }
  }
  const identity: SenderIdentity =
    senderIdentity === "manager" || senderIdentity === "platform"
      ? (senderIdentity as SenderIdentity)
      : "platform"

  // 3. RE-SCOPE — target must be within the caller's reach. Rodada 3: honour the
  // drill-down `?focus=` so an action is gated to the SAME node the page shows.
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    readFocusParam(request),
  )
  if (allowedStudentIds !== null && !new Set(allowedStudentIds).has(studentId)) {
    return NextResponse.json({ error: "Recipient outside your scope" }, { status: 403 })
  }

  // 4. DISPATCH — single recipient. senderName is server-trusted (the caller's
  //    own name), never taken from the payload.
  const senderName =
    identity === "manager" ? ((profile as { full_name?: string | null }).full_name ?? null) : null
  try {
    const result = await dispatchTeamNudge({
      tenantId,
      studentIds: [studentId],
      nudgeType: nudgeType as NudgeType,
      templateKey: typeof templateKey === "string" ? templateKey : null,
      message: typeof message === "string" ? message : null,
      courseId: typeof courseId === "string" ? courseId : null,
      originManagerId: user.id,
      senderIdentity: identity,
      senderName,
    })
    return NextResponse.json({
      inAppCreated: result.inAppCreated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      recipientsSkipped: result.recipientsSkipped,
      total: result.total,
    })
  } catch (err) {
    console.error("[engagement/action] dispatch error:", err)
    const messageText = err instanceof Error ? err.message : "Failed to dispatch action"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
