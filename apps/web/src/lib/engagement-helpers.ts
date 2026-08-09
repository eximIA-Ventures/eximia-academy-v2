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
//   are hard-wired to auth.uid() and fail closed. `null` collapses to `[]`.
//
// RLS FIX, SIGNAL READS (Iteração 3, 2026-07-03): the per-student engagement
// SIGNALS (sessions, reflections, enrollments+pace) are NO LONGER read with the
// manager's AUTHENTICATED client. In production the RLS on those tables only
// grants a manager reach via manager_group_members /
// auth_team_reachable_student_ids() (the GROUP subtree), NEVER via reports_to
// (organograma). But the scope primitives above DO resolve students via
// reports_to (auth_direct_student_ids ramo a). So a student tied to the manager
// ONLY by reports_to was in the universe yet INVISIBLE to the signal reads,
// giving 0 sessions and wrongly bucketing "inativos" even when active today
// (proven in prod, tenant Cory, gestor Rinaldo: all 6 diretos and 12 of 40 in
// Hierarquia, Caio Pinheiro among them, multi-hat with a session today). This
// is the SAME class of bug the "Diretos" fix solved (area-context.ts
// getDirectTeamStudentIds Iteração 3): resolve on the server with a SECURITY
// DEFINER RPC, never a client query over an RLS-protected table. All signals
// now come from ONE call to auth_team_engagement_signals(_ids), which re-gates
// each id to the caller's own authorized reach and can NEVER widen scope (a
// forged out-of-reach id yields no row). See
// supabase/migrations/20260703010000_auth_team_engagement_signals.sql.
//
// THRESHOLDS / PACE are COPIED, not redefined:
//   • 14d / 5d activity thresholds, analytics/page.tsx:377-385 (canonical roster).
//   • pace (deadline_days, expectedPct = elapsed/deadline_days, behind when
//     progressPct < expectedPct), computed INSIDE the RPC, the same formula as
//     manager-dashboard-page.tsx:80-131.
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

// Row shape returned by the auth_team_engagement_signals RPC (one per in-reach
// student). Counts come back as bigint, serialized by PostgREST as number|string
// depending on magnitude, so we coerce defensively (Number()).
interface RawSignalRow {
  student_id: string
  total_sessions: number | string | null
  completed_sessions: number | string | null
  last_activity_at: string | null
  reflections_count: number | string | null
  behind_schedule: boolean | null
}

// Per-student aggregate signal, the minimal projection the classifier needs.
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
 * scope. `db` MUST still be the manager's AUTHENTICATED RLS client: the SIGNAL
 * read now goes through the SECURITY DEFINER RPC auth_team_engagement_signals,
 * which re-gates every id to the caller's own authorized reach (auth.uid()
 * drives that gate). The RPC can NEVER widen scope beyond what the universe
 * primitives already resolved: an id outside the caller's reach yields no row.
 */
async function classifyTeamEngagement(
  db: EngagementClient,
  tenantId: string,
  teamStudentIds: string[],
): Promise<TeamEngagementBuckets> {
  // (2) Empty team → empty buckets, zeroed summary.
  if (teamStudentIds.length === 0) return EMPTY_BUCKETS

  const now = Date.now()

  // (3) NAMES/EMAILS: read from `users` under the manager's RLS client. This is
  // safe because users_select grants a manager tenant-wide user reads
  // (tenant_id = auth_tenant_id()); a multi-hat person in the id set is returned
  // like any other. NO role refilter here: `teamStudentIds` is already the
  // resolved student universe (the RPCs resolve the student hat via user_roles
  // server-side), so filtering by the singular users.role column would drop a
  // gestor+aluno. `.in("id", teamStudentIds)` is the correct, sufficient filter.
  //
  // (4) SIGNALS: read via the SECURITY DEFINER RPC (Iteração 3 RLS fix, see file
  // header). The RPC reads sessions/reflections/enrollments+pace with elevated
  // privilege, re-gated to the caller's authorized reach, so a reports_to-only
  // direct report (invisible to the signal-table RLS under the authenticated
  // client) now gets real signals. Names come from `users`; signals from the
  // RPC; the two are joined by student id below.
  const [usersRes, signalsRes] = await Promise.all([
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .in("id", teamStudentIds),
    db.rpc("auth_team_engagement_signals", { _student_ids: teamStudentIds }),
  ])

  const users = (usersRes.data ?? []) as RawUserRow[]
  const signalRows = (signalsRes.data ?? []) as RawSignalRow[]

  // Index the RPC signals by student id. An id present in the universe but with
  // NO signal row (out of the RPC's authorized reach, or simply no activity yet)
  // falls back to the zeroed signal below, so it is still classified (as
  // inativos, since totalSessions === 0), never silently dropped.
  const signalByStudent = new Map<string, RawSignalRow>()
  for (const row of signalRows) signalByStudent.set(row.student_id, row)

  const toNum = (v: number | string | null): number => {
    const n = typeof v === "string" ? Number(v) : (v ?? 0)
    return Number.isFinite(n) ? (n as number) : 0
  }

  // (5) Build per-student signals from users (names) + RPC (activity). The
  // classifier consumes `signals`; every universe id yields exactly one entry.
  const signals: StudentSignal[] = users.map((u) => {
    const sig = signalByStudent.get(u.id)
    const totalSessions = toNum(sig?.total_sessions ?? 0)

    let daysSinceLastActivity: number | null = null
    if (sig?.last_activity_at) {
      const latest = new Date(sig.last_activity_at).getTime()
      daysSinceLastActivity = Math.floor((now - latest) / 86_400_000)
    }

    return {
      id: u.id,
      name: u.full_name ?? "—",
      email: u.email ?? "",
      totalSessions,
      completedSessions: toNum(sig?.completed_sessions ?? 0),
      reflectionsCount: toNum(sig?.reflections_count ?? 0),
      daysSinceLastActivity,
      behindSchedule: sig?.behind_schedule === true,
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
 *                   {@link getTeamEngagementBuckets}). Signals come from the
 *                   SECURITY DEFINER RPC (auth_team_engagement_signals) over the
 *                   union of `unionStudentIds`, re-gated to the caller's reach,
 *                   so it can never see beyond what the caller already resolved
 *                   per node.
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
