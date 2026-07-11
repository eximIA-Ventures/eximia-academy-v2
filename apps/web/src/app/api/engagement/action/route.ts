// POST /api/engagement/action
// Engagement Center v2 (E3) — an INDIVIDUAL action to ONE student, OR (E12 Rodada
// 6 item 5) a LIGHT bulk send of the SAME composed message to a handful of
// MANUALLY-chosen students. Security trava, same order as
// api/analytics/manager/nudge/route.ts:
//   1. AUTH     — getAuthProfile; admin/manager/instructor only. tenant server-side.
//   2. VALIDATE — studentId(s) UUID, nudgeType in enum, senderIdentity in enum.
//   3. RE-SCOPE — resolveEngagementScope confirms every recipient ∈ caller reach;
//                 anything outside → dropped (never dispatch silently). An empty
//                 surviving set → 403.
//   4. DISPATCH — dispatchTeamNudge for the recipient set. senderName, when
//                 identity=manager, is the AUTHENTICATED caller's name, NEVER a
//                 client-supplied string (prevents signing as someone else).
//
// E12 Rodada 6 item 5 (Hugo ao vivo): the manager can pick a FEW students in the
// Central de Envios picker and send them the SAME message at once. This is a
// pontual, manual send — NOT a Campanha (which is an observable object born from
// an automatic semáforo segment). So it REUSES the SAME dispatch engine
// (dispatchTeamNudge) as a campaign WITHOUT creating a campaign header/observable
// object: it is registered in the Histórico exactly like a single send. The
// request accepts an OPTIONAL `studentIds: string[]` (2..MAX) alongside the legacy
// single `studentId`; when both/either is present the union is the recipient set.
// The 200 cap + the re-scope trava are enforced on that set exactly as a campaign.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { dispatchTeamNudge } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import type { NudgeType, SenderIdentity } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Same FinOps cap as api/engagement/campaign — a "light bulk" send in the Central
// de Envios is still bounded; a real segment-wide blast belongs to Campanhas.
const MAX_RECIPIENTS = 200

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
  const {
    studentId,
    studentIds,
    nudgeType,
    templateKey,
    message,
    courseId,
    senderIdentity,
    channel,
  } = body as {
    studentId?: unknown
    studentIds?: unknown
    nudgeType?: unknown
    templateKey?: unknown
    message?: unknown
    courseId?: unknown
    senderIdentity?: unknown
    channel?: unknown
  }

  // Recipient set: the legacy single `studentId` and/or the new `studentIds[]`
  // (item 5). The union (deduped) is the requested set; at least one valid UUID is
  // required. Every id must be a well-formed UUID (the same trava as before, now
  // applied to each element).
  const requestedIds = new Set<string>()
  if (typeof studentId === "string") {
    if (!UUID_RE.test(studentId)) {
      return NextResponse.json({ error: "studentId must be a UUID" }, { status: 400 })
    }
    requestedIds.add(studentId)
  }
  if (studentIds !== undefined) {
    if (!Array.isArray(studentIds)) {
      return NextResponse.json({ error: "studentIds must be an array" }, { status: 400 })
    }
    for (const id of studentIds) {
      if (typeof id !== "string" || !UUID_RE.test(id)) {
        return NextResponse.json({ error: "studentIds must be UUIDs" }, { status: 400 })
      }
      requestedIds.add(id)
    }
  }
  if (requestedIds.size === 0) {
    return NextResponse.json({ error: "studentId or studentIds is required" }, { status: 400 })
  }
  // Cap on the SUBMITTED set, before scope (same discipline as the campaign route).
  if (requestedIds.size > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 },
    )
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
  // Rodada 4/6 (E12): the channel the manager chose. Only 'inapp'/'email' are
  // meaningful; anything else (absent/malformed) falls back to 'email' — the legacy
  // behaviour where the email mirror rides whenever the template supports it. An
  // explicit 'inapp' SUPPRESSES the email mirror (item 4: the individual/bulk send
  // now honours the manager's channel choice, no longer hardcoded to in-app).
  const sendChannel: "inapp" | "email" = channel === "inapp" ? "inapp" : "email"

  // 3. RE-SCOPE — every target must be within the caller's reach. Rodada 3: honour
  // the drill-down `?focus=` so an action is gated to the SAME node the page shows.
  // Out-of-scope ids are DROPPED (never dispatched); an empty surviving set → 403.
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    readFocusParam(request),
  )
  const requested = [...requestedIds]
  const safeIds =
    allowedStudentIds === null
      ? requested
      : requested.filter((id) => new Set(allowedStudentIds).has(id))
  const droppedOutsideScope = requested.length - safeIds.length
  if (safeIds.length === 0) {
    return NextResponse.json({ error: "Recipient outside your scope" }, { status: 403 })
  }

  // 4. DISPATCH — the surviving recipient set (1..N). senderName is server-trusted
  //    (the caller's own name), never taken from the payload. The SAME message /
  //    template / origin / channel is applied to every recipient (item 5: one
  //    composed message → the few chosen students).
  const senderName =
    identity === "manager" ? ((profile as { full_name?: string | null }).full_name ?? null) : null
  try {
    const result = await dispatchTeamNudge({
      tenantId,
      studentIds: safeIds,
      nudgeType: nudgeType as NudgeType,
      templateKey: typeof templateKey === "string" ? templateKey : null,
      message: typeof message === "string" ? message : null,
      courseId: typeof courseId === "string" ? courseId : null,
      originManagerId: user.id,
      senderIdentity: identity,
      senderName,
      channel: sendChannel,
    })
    return NextResponse.json({
      inAppCreated: result.inAppCreated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      recipientsSkipped: droppedOutsideScope + result.recipientsSkipped,
      total: result.total,
    })
  } catch (err) {
    console.error("[engagement/action] dispatch error:", err)
    const messageText = err instanceof Error ? err.message : "Failed to dispatch action"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
