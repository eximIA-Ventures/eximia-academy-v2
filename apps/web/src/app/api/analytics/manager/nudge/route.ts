// POST /api/analytics/manager/nudge
// Manager team dashboard — dispatch an engagement nudge to a chosen set of
// students FROM A BUCKET (accessed / devendo / inativos). The ORDER of the steps
// below IS the security trava (do not reorder):
//
//   1. AUTH       — getAuthProfile(); 403 unless role === 'manager'. tenant is
//                   resolved SERVER-SIDE (never from the client).
//   2. VALIDATE   — studentIds are UUIDs, 1..200 (FinOps cap), nudgeType in enum.
//   3. RE-SCOPE   — re-resolve the manager's OWN team with the AUTHENTICATED
//                   client (getManagedTeamStudentIds includeSubtree). The passed
//                   studentIds are FILTERED to that team set (safeIds). Anything
//                   outside the team is DROPPED (recipientsSkipped) — a forged id
//                   array can never address a student outside the manager's team.
//   4. DISPATCH   — only safeIds reach dispatchTeamNudge (service client write,
//                   re-asserted by the new group-scoped RLS at the DB layer too).
//
// This is the APP half of the non-leakage invariant; the migration
// 20260630000000_engagement_rls_group_scope.sql is the DB half (defence-in-depth).

import { getManagedTeamStudentIds } from "@/lib/area-context"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { dispatchTeamNudge } from "@/lib/notifications/engine"
import type { NudgeType } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Must mirror the NudgeType CHECK constraint / the TS enum exactly.
const NUDGE_TYPES: ReadonlySet<NudgeType> = new Set<NudgeType>([
  "never_accessed",
  "inactive",
  "no_reflection",
  "top_performer",
  "announcement",
  "custom",
])

// FinOps cap (see .claude/rules/finops-guardrails.md): a single dispatch may not
// fan out to more than 200 recipients.
const MAX_RECIPIENTS = 200

export async function POST(request: Request) {
  // 1. AUTH — manager only. tenant resolved server-side.
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (profile.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  // 2. VALIDATE payload.
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { studentIds, nudgeType, templateKey, message, courseId } = body as {
    studentIds?: unknown
    nudgeType?: unknown
    templateKey?: unknown
    message?: unknown
    courseId?: unknown
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: "studentIds is required" }, { status: 400 })
  }
  if (studentIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 },
    )
  }
  const requestedIds = [...new Set(studentIds)]
  if (!requestedIds.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json({ error: "studentIds must be UUIDs" }, { status: 400 })
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

  // 3. RE-SCOPE — the NON-LEAKAGE trava. Re-resolve the manager's OWN team with
  //    the AUTHENTICATED client (includeSubtree reads auth.uid()), then filter the
  //    requested ids to that team. `null` collapses to []. Anything not on the team
  //    is dropped and reported as recipientsSkipped — never dispatched.
  //    INTENTIONALLY the full subtree (includeSubtree:true), NOT the Hierarquia/
  //    Visão Global switch: the switch only narrows what the UI OFFERS as
  //    recipients (via the already-scoped buckets in team-engagement-header.tsx);
  //    the security floor here stays the widest set the manager may EVER reach,
  //    so a stale/forged `studentIds` payload can't outlive a mode change.
  const teamScope =
    (await getManagedTeamStudentIds(supabase, tenantId, user.id, { includeSubtree: true })) ?? []
  const teamSet = new Set(teamScope)
  const safeIds = (requestedIds as string[]).filter((id) => teamSet.has(id))
  const droppedOutsideTeam = requestedIds.length - safeIds.length

  if (safeIds.length === 0) {
    return NextResponse.json(
      { error: "No recipients within your team", recipientsSkipped: droppedOutsideTeam },
      { status: 400 },
    )
  }

  // 4. DISPATCH — only team-bound ids. dispatchTeamNudge re-asserts tenant + role
  //    and (via the service client) writes under the group-scoped RLS.
  try {
    const result = await dispatchTeamNudge({
      tenantId,
      studentIds: safeIds,
      nudgeType: nudgeType as NudgeType,
      templateKey: typeof templateKey === "string" ? templateKey : null,
      message: typeof message === "string" ? message : null,
      courseId: typeof courseId === "string" ? courseId : null,
      originManagerId: user.id,
    })

    return NextResponse.json({
      inAppCreated: result.inAppCreated,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      emailRowsFailed: result.emailRowsFailed,
      // Skipped = dropped for being outside the team + dropped in the tenant/role
      // re-scope inside the engine.
      recipientsSkipped: droppedOutsideTeam + result.recipientsSkipped,
      total: result.total,
    })
  } catch (err) {
    console.error("[manager-nudge] dispatch error:", err)
    const messageText = err instanceof Error ? err.message : "Failed to dispatch nudge"
    return NextResponse.json({ error: messageText }, { status: 500 })
  }
}
