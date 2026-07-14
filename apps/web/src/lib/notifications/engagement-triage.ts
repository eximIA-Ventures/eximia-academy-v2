// ---------------------------------------------------------------------------
// Engagement Center v2 — shared CANONICAL triage for the /engagement recorte.
// ---------------------------------------------------------------------------
// E12 Rodada 5, item 1 (achado Dave Malouf): the /engagement overview used to
// REIMPLEMENT its own risk logic — a local magic `SEM_ACESSO_DAYS = 14` and an
// "atenção" defined narrowly as `!hasSession`, IGNORING behind-teaching-plan. That
// meant the SAME student could land in a different risk bucket depending on which
// screen the manager looked at (overview cards vs the main dashboard). This helper
// is the ONE server-side path both surfaces call, so the taxonomy is identical.
//
// It reuses the canonical `student-triage.ts` engine VERBATIM (computeStudentRitmo
// / computeStudentTriagem / computeTriageSummary — consumed, never modified) and
// the SAME behind/pace computation the students route already uses (deadline vs
// elapsed progress → `behind`). The output is the canonical TriageSummary
// (noRitmo / atencao / semAcesso), the exact shape the dashboard's TriageCards
// render — so /engagement can render those same three cards (item 3).
// ---------------------------------------------------------------------------

import { type ActivityStampRow, latestActivityMs } from "@/lib/analytics/last-activity"
import {
  type StudentPace,
  type TriageInput,
  computeStudentRitmo,
  computeStudentTriagem,
  computeTriageSummary,
} from "@/lib/student-triage"
import type { SupabaseClient } from "@supabase/supabase-js"

// biome-ignore lint/suspicious/noExplicitAny: service client, same shape used across engagement routes
type ServiceClient = SupabaseClient<any, "public", any>

export interface EnrollmentRow {
  student_id: string
  status: string | null
  created_at: string
  progress: { percentage?: number | string | null } | null
  course_id: string
}

/**
 * Same `behind` formula as the students route / engine.computeBehindStudentIds /
 * the auth_team_engagement_signals RPC (single source of truth — NOT a new
 * definition): active enrollment + deadline_days>0 + progress% < expectedPct.
 * Also returns the max progress % per student (for the ritmo `courseProgressPct`).
 */
export function computeBehindAndProgress(
  enrollments: EnrollmentRow[],
  deadlineByCourse: Map<string, number | null>,
  now: number,
): { behind: Set<string>; progressByStudent: Map<string, number> } {
  const behind = new Set<string>()
  const progressByStudent = new Map<string, number>()
  for (const e of enrollments) {
    const rawPct = e.progress?.percentage
    const progressPct = typeof rawPct === "string" ? Number(rawPct) : (rawPct ?? 0)
    const pct = Number.isFinite(progressPct) ? (progressPct as number) : 0
    const prev = progressByStudent.get(e.student_id) ?? 0
    if (pct > prev) progressByStudent.set(e.student_id, pct)

    if (e.status !== "active") continue
    const deadlineDays = deadlineByCourse.get(e.course_id) ?? null
    if (deadlineDays === null || deadlineDays <= 0) continue
    const createdMs = new Date(e.created_at).getTime()
    if (Number.isNaN(createdMs)) continue
    const elapsedDays = Math.max(0, (now - createdMs) / 86_400_000)
    const expectedPct = Math.min(100, Math.round((elapsedDays / deadlineDays) * 100))
    if (pct < expectedPct) behind.add(e.student_id)
  }
  return { behind, progressByStudent }
}

export interface EngagementTriageResult {
  /** Canonical TriageSummary (analisados / noRitmo / atencao / semAcesso + pct). */
  summary: import("@/lib/student-triage").TriageSummary
  /** Per-student canonical triagem, for callers that need the breakdown. */
  triagemByStudent: Map<string, import("@/lib/student-triage").StudentTriagem>
  /**
   * E15: per-student session count over the scoped set. Additive field so the
   * campaign engine can derive `nudgeType` per aluno via `computeStudentAction`
   * (never_accessed when totalSessions===0, inactive otherwise) WITHOUT a second
   * roster read. Existing consumers destructure only summary/triagemByStudent and
   * are unaffected.
   */
  sessionCountByStudent: Map<string, number>
}

/**
 * Computes the CANONICAL triage summary for a scoped set of students, using the
 * SAME taxonomy the dashboard uses (student-triage.ts). `allowedStudentIds`:
 *   • `null`  → tenant-wide (admin): the whole tenant's students.
 *   • `[]`    → fail-closed (no reachable students): empty summary.
 *   • [ids]   → exactly those students.
 *
 * Reads run on the passed SERVICE client, already bounded by `allowedStudentIds`
 * (the caller resolved that via resolveEngagementScope) — the same trava pattern
 * as the students route (`.in("id", allowedStudentIds)`).
 */
export async function computeEngagementTriage(
  svc: ServiceClient,
  tenantId: string,
  allowedStudentIds: string[] | null,
  now: number = Date.now(),
): Promise<EngagementTriageResult> {
  const emptySummary = computeTriageSummary([])
  // Fail-closed: a scoped caller with no reachable students → empty summary.
  if (allowedStudentIds !== null && allowedStudentIds.length === 0) {
    return { summary: emptySummary, triagemByStudent: new Map(), sessionCountByStudent: new Map() }
  }

  // Bound every read to the recorte. null = tenant-wide (admin); otherwise
  // `.in(col, ids)` is the trava (same pattern as the students route). The
  // builders are typed `any` locally to avoid TS2589 (the Supabase query builder
  // generics blow up when threaded through a generic helper); the reads are still
  // scoped by the explicit `.in()` below.
  // biome-ignore lint/suspicious/noExplicitAny: query builders, scoped by explicit .in()
  let usersQuery: any = svc
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
  // biome-ignore lint/suspicious/noExplicitAny: see above
  let sessionsQuery: any = svc
    .from("sessions")
    .select("student_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
  // Reflections are platform activity too — a reused session only moves its
  // updated_at, and a student writing/editing reflections must not be triaged
  // "sem_acesso" (same fix as the home "Último acesso", caso Rinaldo).
  // biome-ignore lint/suspicious/noExplicitAny: see above
  let reflectionsQuery: any = svc
    .from("slide_reflections")
    .select("student_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
  // biome-ignore lint/suspicious/noExplicitAny: see above
  let enrollmentsQuery: any = svc
    .from("enrollments")
    .select("student_id, status, created_at, progress, course_id")
    .eq("tenant_id", tenantId)
  if (allowedStudentIds !== null) {
    usersQuery = usersQuery.in("id", allowedStudentIds)
    sessionsQuery = sessionsQuery.in("student_id", allowedStudentIds)
    reflectionsQuery = reflectionsQuery.in("student_id", allowedStudentIds)
    enrollmentsQuery = enrollmentsQuery.in("student_id", allowedStudentIds)
  }

  const [studentsRes, sessionsRes, reflectionsRes, enrollmentsRes] = await Promise.all([
    usersQuery,
    sessionsQuery,
    reflectionsQuery,
    enrollmentsQuery,
  ])

  // Defence in depth: the `.in()` above is the DB-level trava, but we ALSO filter
  // in JS (same belt-and-suspenders as the overview route always did) so a read
  // that over-returns can never inflate a card. `null` scope = tenant-wide (admin).
  const scopeSet = allowedStudentIds === null ? null : new Set(allowedStudentIds)
  const inScope = (id: string | null | undefined): boolean =>
    scopeSet === null || (id != null && scopeSet.has(id))

  const students = ((studentsRes.data ?? []) as { id: string }[]).filter((s) => inScope(s.id))
  const sessions = (
    (sessionsRes.data ?? []) as ({ student_id: string } & ActivityStampRow)[]
  ).filter((s) => inScope(s.student_id))
  const reflections = (
    (reflectionsRes.data ?? []) as ({ student_id: string } & ActivityStampRow)[]
  ).filter((r) => inScope(r.student_id))
  const enrollments = ((enrollmentsRes.data ?? []) as EnrollmentRow[]).filter((e) =>
    inScope(e.student_id),
  )

  // Deadlines for the courses in this enrollment set only.
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))]
  const coursesRes =
    courseIds.length > 0
      ? await svc
          .from("courses")
          .select("id, deadline_days")
          .eq("tenant_id", tenantId)
          .in("id", courseIds)
      : { data: [] as { id: string; deadline_days: number | null }[] }
  const deadlineByCourse = new Map<string, number | null>()
  for (const c of (coursesRes.data ?? []) as { id: string; deadline_days: number | null }[]) {
    deadlineByCourse.set(c.id, c.deadline_days)
  }

  // Per-student aggregates: session count, last ACTIVITY date, enrollment counts.
  // Activity = max(created_at, updated_at) of sessions + reflections (a reused
  // session only moves updated_at; reflections count as access) — same rule as
  // the home "Último acesso" (student-home-indicators.ts).
  const sessionCount = new Map<string, number>()
  const latestByStudent = new Map<string, number>()
  const bumpLatest = (id: string, row: ActivityStampRow) => {
    const t = latestActivityMs(row)
    if (t === null) return
    const prev = latestByStudent.get(id)
    if (prev === undefined || t > prev) latestByStudent.set(id, t)
  }
  for (const s of sessions) {
    sessionCount.set(s.student_id, (sessionCount.get(s.student_id) ?? 0) + 1)
    bumpLatest(s.student_id, s)
  }
  for (const r of reflections) bumpLatest(r.student_id, r)

  const enrolledByStudent = new Map<string, number>()
  const completedByStudent = new Map<string, number>()
  for (const e of enrollments) {
    enrolledByStudent.set(e.student_id, (enrolledByStudent.get(e.student_id) ?? 0) + 1)
    if (e.status === "completed") {
      completedByStudent.set(e.student_id, (completedByStudent.get(e.student_id) ?? 0) + 1)
    }
  }

  const { behind, progressByStudent } = computeBehindAndProgress(enrollments, deadlineByCourse, now)
  const paceByStudent = new Map<string, StudentPace>()
  for (const id of behind) paceByStudent.set(id, "behind")

  const triagemByStudent = new Map<string, import("@/lib/student-triage").StudentTriagem>()
  for (const stu of students) {
    const totalSessions = sessionCount.get(stu.id) ?? 0
    const latest = latestByStudent.get(stu.id)
    const lastSessionDate = latest !== undefined ? new Date(latest).toISOString() : null
    const row: TriageInput = {
      id: stu.id,
      totalSessions,
      lastSessionDate,
      courseProgressPct: Math.round(progressByStudent.get(stu.id) ?? 0),
      coursesEnrolled: enrolledByStudent.get(stu.id) ?? 0,
      coursesCompleted: completedByStudent.get(stu.id) ?? 0,
    }
    const ritmo = computeStudentRitmo(row, paceByStudent)
    triagemByStudent.set(stu.id, computeStudentTriagem(row, ritmo, now))
  }

  const summary = computeTriageSummary([...triagemByStudent.values()])
  // Per-student session count (0 for a student with no session rows) so the
  // campaign engine can derive nudgeType per aluno without a second read.
  const sessionCountByStudent = new Map<string, number>()
  for (const stu of students) sessionCountByStudent.set(stu.id, sessionCount.get(stu.id) ?? 0)
  return { summary, triagemByStudent, sessionCountByStudent }
}
