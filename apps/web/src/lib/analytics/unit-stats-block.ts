import type { UnitStats } from "@/types/analytics"

export interface UnitStatsSessionRow {
  student_id: string
  status: string | null
  created_at: string
}

export interface UnitStatsReflectionRow {
  student_id: string
}

/**
 * Builds ONE UnitStats-shaped block (totalStudents/activeStudents/completedSessions/
 * completionPct/...) for an arbitrary student population. Single source of truth
 * for the math analytics/page.tsx used to inline per-UNIDADE (see the `unitStats`
 * `.map()` there) — extracted (T2, Crivo review, 2026-07-18) so a MANAGER'S TEAM
 * ("Meu Time", not a `areas` row) can produce the exact same shape the "Uso da
 * Plataforma" hero (`aggregateUsoStats` in analytics-dashboard.tsx) reduces over.
 *
 * Before this fix, `unitStats` was hard-coded to `[]` for the manager lens (no
 * `areas` row represents a team), so the hero/sub-metrics silently reduced over
 * an empty array (0%/0%/0.0) while the SAME recorte's roster (`allStudentsList` /
 * `allSessionsRoster` — Tabela simplificada equivalent) showed real progress —
 * two screens, same recorte, incompatible numbers. `sessions`/`reflections` are
 * expected to be PRE-SCOPED to the caller's recorte already (mirrors every other
 * consumer of `allSessionsRoster`/`allReflectionsRoster` in page.tsx); this
 * function additionally intersects by `studentIds` so passing the raw
 * roster-scoped arrays for a subset (e.g. one UNIDADE within a scoped roster) is
 * still correct.
 */
export function buildUnitStatsBlock(
  areaName: string,
  studentIds: string[],
  sessions: UnitStatsSessionRow[],
  reflections: UnitStatsReflectionRow[],
  totalChapters: number,
  now: number,
): UnitStats {
  const students = new Set(studentIds)
  const mySessions = sessions.filter((s) => students.has(s.student_id))
  const myReflections = reflections.filter((r) => students.has(r.student_id))
  const completedSessions = mySessions.filter((s) => s.status === "completed").length
  const thirtyDaysAgo = now - 30 * 86_400_000
  const activeStudents = new Set(
    mySessions
      .filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo)
      .map((s) => s.student_id),
  ).size
  const completionPossible = students.size * totalChapters
  const completionPct =
    completionPossible > 0 ? Math.round((completedSessions / completionPossible) * 100) : 0

  return {
    areaName,
    totalStudents: students.size,
    activeStudents,
    completedSessions,
    totalSessions: mySessions.length,
    reflectionCount: myReflections.length,
    avgSessionsPerStudent:
      students.size > 0 ? Math.round((mySessions.length / students.size) * 10) / 10 : 0,
    completionPct,
  }
}
