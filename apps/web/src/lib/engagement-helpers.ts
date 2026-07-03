// ---------------------------------------------------------------------------
// Manager Team Engagement — actionable bucket classification
// ---------------------------------------------------------------------------
// `getTeamEngagementBuckets` is the read primitive behind the manager team
// dashboard header. It takes a manager (or a focused subtree node) and classifies
// EVERY student on that team into exactly one of three actionable buckets:
//
//   • accessed  — active recently (daysSinceLastActivity <= 5) and not "devendo".
//   • devendo   — NOT inactive, but owes something: either (a) at_risk
//                 (5 < days <= 14, the canonical roster threshold) OR (b) behind
//                 schedule (an active enrollment whose progress < expected pace).
//   • inativos  — 0 sessions ever, OR daysSinceLastActivity > 14.
//
// Priority is inativos > devendo > accessed, so each student lands in exactly one
// bucket and the three counts sum to teamTotal.
//
// NON-LEAKAGE INVARIANT (the whole point):
//   The student universe is resolved ONLY through the E9 team-scope primitives —
//   `getSubtreeStudentIdsAtNode` (focused node, gated) or
//   `getManagedTeamStudentIds(..., {includeSubtree:true})` (whole subtree). Both
//   are hard-wired to auth.uid() and fail closed. `null` collapses to `[]`. No
//   query here ever widens beyond that set: every read is `.in(..., teamStudentIds)`.
//
// THRESHOLDS / PACE are COPIED, not redefined:
//   • 14d / 5d activity thresholds — analytics/page.tsx:377-385 (canonical roster).
//   • pace (deadline_days, expectedPct = elapsed/deadline_days, behind when
//     progressPct < expectedPct) — manager-dashboard-page.tsx:80-131.
// ---------------------------------------------------------------------------

import {
  getDirectTeamStudentIds,
  getManagedTeamStudentIds,
  getSubtreeStudentIdsAtNode,
} from "@/lib/area-context"
import type { TeamViewMode } from "@/lib/team-view-context"
import type { SupabaseClient } from "@supabase/supabase-js"

// Loose client shape (matches the area-context helpers + createServiceClient) so
// we can query tables not yet in the generated Database type without fighting the
// generics. `db` here MUST be the manager's AUTHENTICATED RLS client: the E9
// scope primitives read auth.uid() (see area-context.ts contracts).
// biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS client, matches area-context.ts
type EngagementClient = SupabaseClient<any, "public", any>

// Canonical roster thresholds — DO NOT redefine. Copied verbatim from
// analytics/page.tsx:377-385 so this classification matches the roster the
// manager already sees elsewhere.
const INACTIVE_DAYS = 14 // > 14 days since last activity → inativos
const AT_RISK_DAYS = 5 // 5 < days <= 14 → at_risk (a "devendo" reason)

export type EngagementBucket = "accessed" | "devendo" | "inativos"

/** Why a student landed in `devendo` (a student may owe for more than one reason). */
export type DevendoReason = "sem_atividade_recente" | "atras_cronograma"

export interface EngagementStudent {
  id: string
  name: string
  email: string
  /** Whole days since the most recent session; `null` when the student has none. */
  daysSinceLastActivity: number | null
  bucket: EngagementBucket
  /** Present (and non-empty) only for the `devendo` bucket. */
  devendoReasons?: DevendoReason[]
}

export interface EngagementSummary {
  accessedCount: number
  devendoCount: number
  inativosCount: number
  teamTotal: number
}

export interface TeamEngagementBuckets {
  accessed: EngagementStudent[]
  devendo: EngagementStudent[]
  inativos: EngagementStudent[]
  summary: EngagementSummary
}

const EMPTY_SUMMARY: EngagementSummary = {
  accessedCount: 0,
  devendoCount: 0,
  inativosCount: 0,
  teamTotal: 0,
}

const EMPTY_BUCKETS: TeamEngagementBuckets = {
  accessed: [],
  devendo: [],
  inativos: [],
  summary: EMPTY_SUMMARY,
}

interface RawUserRow {
  id: string
  full_name: string | null
  email: string | null
}

interface RawSessionRow {
  student_id: string
  status: string | null
  created_at: string
}

interface RawReflectionRow {
  student_id: string
}

interface RawEnrollmentRow {
  student_id: string
  course_id: string
  progress: unknown
  created_at: string
}

// Per-student aggregate signal — the minimal projection the classifier needs.
interface StudentSignal {
  id: string
  name: string
  email: string
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  daysSinceLastActivity: number | null
  behindSchedule: boolean
}

/**
 * Resolves the manager's team, then classifies every student on it into the
 * three actionable engagement buckets.
 *
 * @param db           the manager's AUTHENTICATED RLS client (E9 reads auth.uid()).
 * @param tenantId     server-resolved tenant. Never from the client.
 * @param managerId    the authenticated manager's user id (= subtree root).
 * @param focusUserId  optional E9 drill-down node. When set, the universe is
 *                     resolved AT that node; when null/undefined, at the
 *                     manager's own root. A forged/out-of-scope node yields [].
 * @param teamViewMode "direct" (default) = only the focused node's direct
 *                     students (getDirectTeamStudentIds); "hierarchy" = the
 *                     node's whole reachable subtree (previous "global"
 *                     behaviour, unchanged). Applies to WHICHEVER node is
 *                     focused.
 */
export async function getTeamEngagementBuckets(
  db: EngagementClient,
  tenantId: string,
  managerId: string,
  focusUserId?: string | null,
  teamViewMode: TeamViewMode = "direct",
): Promise<TeamEngagementBuckets> {
  // (1) TEAM SCOPE — the only source of the student universe. Mirrors the
  // wiring in manager-dashboard-page.tsx: a focused node resolves at that
  // node; otherwise at the manager's own root. `teamViewMode` picks
  // direct-vs-subtree at whichever node is in play. `null`/[] collapses safely.
  const node = focusUserId ?? managerId
  const teamStudentIds: string[] =
    teamViewMode === "hierarchy"
      ? focusUserId
        ? await getSubtreeStudentIdsAtNode(db, tenantId, focusUserId)
        : ((await getManagedTeamStudentIds(db, tenantId, managerId, { includeSubtree: true })) ??
          [])
      : await getDirectTeamStudentIds(db, tenantId, node)

  return classifyTeamEngagement(db, tenantId, teamStudentIds)
}

/**
 * Classifies an ALREADY-RESOLVED student id set into the three actionable
 * engagement buckets. Extracted from {@link getTeamEngagementBuckets} so
 * batch callers (per-subteam mini-indicators, see
 * {@link getSubteamEngagementSummaries}) can reuse the exact same
 * classification logic against a student universe they resolved themselves
 * (e.g. one node of "Times abaixo"), without re-deriving the manager/focus
 * scope. `db` MUST still be the manager's AUTHENTICATED RLS client — this
 * function does no scope resolution of its own, it only reads signals for
 * the ids it is given (same non-leakage invariant: every read is
 * `.in(..., teamStudentIds)`).
 */
async function classifyTeamEngagement(
  db: EngagementClient,
  tenantId: string,
  teamStudentIds: string[],
): Promise<TeamEngagementBuckets> {
  // (2) Empty team → empty buckets, zeroed summary.
  if (teamStudentIds.length === 0) return EMPTY_BUCKETS

  const now = Date.now()

  // (3) Pull users + activity signals, ALL constrained to the team set. The
  // `.in("id"/"student_id", teamStudentIds)` clauses are the non-leakage trava at
  // the read layer (the RLS client is the trava at the DB layer).
  //
  // ROLE FILTER (Iteração 2, multi-chapéu fix): `teamStudentIds` is ALREADY the
  // resolved student universe (getDirectTeamStudentIds / subtree helpers), so
  // re-filtering `users` by the SINGULAR `role='student'` column here would
  // silently drop a multi-hat person (e.g. gestor+aluno) who IS in the id set
  // but whose primary `users.role` is 'manager'. `.in("id", teamStudentIds)`
  // alone is the correct, sufficient filter — the id set is the source of
  // truth for "who is a student of this scope", not the singular role column.
  const [usersRes, sessionsRes, reflectionsRes] = await Promise.all([
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .in("id", teamStudentIds),
    db
      .from("sessions")
      .select("student_id, status, created_at")
      .eq("tenant_id", tenantId)
      .in("student_id", teamStudentIds),
    db
      .from("slide_reflections")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("student_id", teamStudentIds),
  ])

  const users = (usersRes.data ?? []) as RawUserRow[]
  const sessions = (sessionsRes.data ?? []) as RawSessionRow[]
  const reflections = (reflectionsRes.data ?? []) as RawReflectionRow[]

  // (4) PACE — behind-schedule detection, COPIED from manager-dashboard-page.tsx:
  // a course with a NON-NULL deadline_days, an active enrollment, expectedPct =
  // elapsed/deadline_days, behind when progressPct < expectedPct. deadline_days
  // NULL → the course is never "behind" (it simply isn't in deadlineCourses), so
  // a student only reaches `devendo` via reason (a). ANY behind enrollment flags
  // the student `atras_cronograma`.
  const behindByStudent = new Set<string>()
  const { data: deadlineCourses } = await db
    .from("courses")
    .select("id, deadline_days")
    .eq("tenant_id", tenantId)
    .not("deadline_days", "is", null)

  const deadlineCourseRows = (deadlineCourses ?? []) as { id: string; deadline_days: number }[]
  if (deadlineCourseRows.length > 0) {
    const deadlineDaysByCourse = new Map(deadlineCourseRows.map((c) => [c.id, c.deadline_days]))
    const courseIds = deadlineCourseRows.map((c) => c.id)

    const { data: activeEnrollments } = await db
      .from("enrollments")
      .select("student_id, course_id, progress, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("course_id", courseIds)
      .in("student_id", teamStudentIds)

    for (const e of (activeEnrollments ?? []) as RawEnrollmentRow[]) {
      const deadlineDays = deadlineDaysByCourse.get(e.course_id)
      // Guard: treat deadline_days <= 0 (and null) as "no deadline" → never
      // 'behind'. This is an INTENTIONAL divergence from the canonical pace calc
      // (manager-dashboard-page.tsx), which would compute expectedPct =
      // elapsed/0 = Infinity → clamped to 100, flagging EVERYONE behind. A
      // deadline_days <= 0 is an invalid config, so we fail open (no false
      // 'behind') rather than mass-flag the team on a nonsensical value.
      if (deadlineDays == null || deadlineDays <= 0) continue
      const enrolled = new Date(e.created_at).getTime()
      const elapsed = Math.max(0, (now - enrolled) / 86_400_000)
      const expectedPct = Math.min(100, Math.round((elapsed / deadlineDays) * 100))
      const progressPct = (e.progress as { percentage?: number } | null)?.percentage ?? 0
      // behind === progressPct < expectedPct (manager-dashboard-page.tsx:119).
      if (progressPct < expectedPct) behindByStudent.add(e.student_id)
    }
  }

  // (5) Reduce to per-student signals.
  const sessionsByStudent = new Map<string, RawSessionRow[]>()
  for (const s of sessions) {
    const list = sessionsByStudent.get(s.student_id) ?? []
    list.push(s)
    sessionsByStudent.set(s.student_id, list)
  }
  const reflectionCountByStudent = new Map<string, number>()
  for (const r of reflections) {
    reflectionCountByStudent.set(
      r.student_id,
      (reflectionCountByStudent.get(r.student_id) ?? 0) + 1,
    )
  }

  const signals: StudentSignal[] = users.map((u) => {
    const mySessions = sessionsByStudent.get(u.id) ?? []
    const completedSessions = mySessions.filter((s) => s.status === "completed").length

    let daysSinceLastActivity: number | null = null
    if (mySessions.length > 0) {
      const latest = Math.max(...mySessions.map((s) => new Date(s.created_at).getTime()))
      daysSinceLastActivity = Math.floor((now - latest) / 86_400_000)
    }

    return {
      id: u.id,
      name: u.full_name ?? "—",
      email: u.email ?? "",
      totalSessions: mySessions.length,
      completedSessions,
      reflectionsCount: reflectionCountByStudent.get(u.id) ?? 0,
      daysSinceLastActivity,
      behindSchedule: behindByStudent.has(u.id),
    }
  })

  // (6) Classify — priority inativos > devendo > accessed (exactly one bucket).
  const buckets: TeamEngagementBuckets = {
    accessed: [],
    devendo: [],
    inativos: [],
    summary: { accessedCount: 0, devendoCount: 0, inativosCount: 0, teamTotal: signals.length },
  }

  for (const sig of signals) {
    const days = sig.daysSinceLastActivity
    const isInactive = sig.totalSessions === 0 || (days !== null && days > INACTIVE_DAYS)

    if (isInactive) {
      buckets.inativos.push({
        id: sig.id,
        name: sig.name,
        email: sig.email,
        daysSinceLastActivity: days,
        bucket: "inativos",
      })
      continue
    }

    // NOT inactive from here. "devendo" reasons:
    //   (a) at_risk: accessed but going quiet (5 < days <= 14) → sem_atividade_recente.
    //       This reason measures SESSION recency (MAX(sessions.created_at)), NOT
    //       reflections — the label must say "atividade", not "reflexão".
    //   (b) behind schedule (active enrollment past expected pace) → atras_cronograma.
    const reasons: DevendoReason[] = []
    if (days !== null && days > AT_RISK_DAYS) reasons.push("sem_atividade_recente")
    if (sig.behindSchedule) reasons.push("atras_cronograma")

    if (reasons.length > 0) {
      buckets.devendo.push({
        id: sig.id,
        name: sig.name,
        email: sig.email,
        daysSinceLastActivity: days,
        bucket: "devendo",
        devendoReasons: reasons,
      })
      continue
    }

    // accessed: active (days <= 5) and owes nothing.
    buckets.accessed.push({
      id: sig.id,
      name: sig.name,
      email: sig.email,
      daysSinceLastActivity: days,
      bucket: "accessed",
    })
  }

  buckets.summary.accessedCount = buckets.accessed.length
  buckets.summary.devendoCount = buckets.devendo.length
  buckets.summary.inativosCount = buckets.inativos.length
  // teamTotal already = signals.length; the three counts sum to it by construction.

  return buckets
}

// ---------------------------------------------------------------------------
// Per-subteam mini-indicator (Hierarquia mode, "Times abaixo" cards)
// ---------------------------------------------------------------------------
// Iteração 2 (redesign dos buckets, 2026-07-02): each "Times abaixo" card gets
// a small engagement indicator (e.g. "2/9 ativos") next to its student count.
// Computing this ONE-NODE-AT-A-TIME (N calls to getTeamEngagementBuckets, one
// per card) would mean N x the read fan-out of a single dashboard render — the
// same `sessions`/`slide_reflections`/`courses`/`enrollments` queries repeated
// per subteam. Instead, this resolves the summary for EVERY subteam node in
// ONE PASS: a single batched read over the UNION of all subteam student ids,
// classified once, then re-partitioned back per node in memory.
// ---------------------------------------------------------------------------

export interface SubteamStudentSet {
  /** The subteam's node id (a direct-report manager under the focused node). */
  nodeId: string
  /** That node's own resolved subtree student ids (already gated upstream). */
  studentIds: string[]
}

/**
 * Resolves the engagement summary (accessed/devendo/inativos counts) for
 * EVERY subteam in `subteams`, in a single batched pass.
 *
 * @param db        the manager's AUTHENTICATED RLS client (same as
 *                   {@link getTeamEngagementBuckets} — every read here is
 *                   `.in(..., unionStudentIds)`, so it can never see beyond
 *                   what the caller already resolved per node).
 * @param tenantId  server-resolved tenant.
 * @param subteams  each node's ALREADY-RESOLVED subtree student ids (e.g.
 *                   from `resolveDrilldownNav`'s `subtree_student_ids` RPC
 *                   per candidate — no additional gating happens here, the
 *                   caller is responsible for having gated `nodeId` already).
 * @returns a Map from `nodeId` to its {@link EngagementSummary}. A node with
 *          an empty `studentIds` maps to the zeroed summary.
 */
export async function getSubteamEngagementSummaries(
  db: EngagementClient,
  tenantId: string,
  subteams: SubteamStudentSet[],
): Promise<Map<string, EngagementSummary>> {
  const result = new Map<string, EngagementSummary>()
  if (subteams.length === 0) return result

  // Union of every subteam's students — the single universe this function
  // reads signals for. A student who sits in more than one subteam's subtree
  // (shouldn't normally happen — subtrees are disjoint by construction — but
  // is not assumed) is still classified once and simply counted in both.
  const unionIds = [...new Set(subteams.flatMap((s) => s.studentIds))]
  for (const s of subteams) {
    if (s.studentIds.length === 0) result.set(s.nodeId, EMPTY_SUMMARY)
  }
  if (unionIds.length === 0) return result

  const buckets = await classifyTeamEngagement(db, tenantId, unionIds)

  // Re-partition the union classification back into each node's own summary
  // by checking bucket membership per student id (no re-querying).
  const bucketOf = new Map<string, EngagementBucket>()
  for (const s of buckets.accessed) bucketOf.set(s.id, "accessed")
  for (const s of buckets.devendo) bucketOf.set(s.id, "devendo")
  for (const s of buckets.inativos) bucketOf.set(s.id, "inativos")

  for (const s of subteams) {
    if (s.studentIds.length === 0) continue // already set to EMPTY_SUMMARY above
    let accessedCount = 0
    let devendoCount = 0
    let inativosCount = 0
    for (const id of s.studentIds) {
      const bucket = bucketOf.get(id)
      if (bucket === "accessed") accessedCount++
      else if (bucket === "devendo") devendoCount++
      else if (bucket === "inativos") inativosCount++
    }
    result.set(s.nodeId, {
      accessedCount,
      devendoCount,
      inativosCount,
      teamTotal: s.studentIds.length,
    })
  }

  return result
}
