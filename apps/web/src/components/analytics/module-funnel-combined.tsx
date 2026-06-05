"use client"

/**
 * ModuleFunnelCombined — Item 4
 *
 * Unifies the two separate cards that previously existed in analytics-dashboard.tsx:
 *   • "Módulos Mais Acessados"  (moduleAccess data)
 *   • "Funil de Progresso"      (progressFunnel data)
 *
 * The new chart shows BOTH simultaneously per chapter (module), ordered by
 * chapterOrder:
 *   • Left segment  (cerrado-600): number of sessions recorded for this chapter
 *   • Right badge:  % of students who reached this chapter (funnel %)
 *   • Bottom line:  distinct student count who accessed the chapter
 *
 * The integrator should:
 *   1. Import this component.
 *   2. Pass the `moduleAccess` and `progressFunnel` arrays already available in
 *      analytics-dashboard.tsx.
 *   3. REMOVE the two old inline cards:
 *        - The "Módulos Mais Acessados" card (lines ~372–390 in analytics-dashboard.tsx)
 *        - The "Funil de Progresso" card (lines ~421–445 in analytics-dashboard.tsx)
 *      These live inside the `<div className="grid gap-6 lg:grid-cols-3">` block.
 *      After removing both, the grid becomes lg:grid-cols-1 or the remaining
 *      "Modos de Interação" card can stand alone — adjust layout as preferred.
 *
 * Props mirror the types already declared in analytics-dashboard.tsx (no new
 * imports required from the dashboard side).
 */

// ---------------------------------------------------------------------------
// Types (self-contained — mirrors dashboard types to avoid circular dep)
// ---------------------------------------------------------------------------

export interface ModuleAccessItem {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  sessionCount: number
  completedCount: number
  studentCount: number
}

export interface ProgressFunnelItem {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  studentsReached: number
  totalStudents: number
}

interface ModuleFunnelCombinedProps {
  moduleAccess: ModuleAccessItem[]
  progressFunnel: ProgressFunnelItem[]
  /**
   * Optional CSS class on the outermost container.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge moduleAccess + progressFunnel by chapterTitle (the common key).
 * Sorts result by chapterOrder ascending. Falls back gracefully when one side
 * has no matching entry (the missing metric renders as 0 / "—").
 */
function buildCombinedRows(
  access: ModuleAccessItem[],
  funnel: ProgressFunnelItem[],
): Array<{
  courseId: string
  chapterTitle: string
  chapterOrder: number
  sessionCount: number
  studentCount: number
  completedCount: number
  studentsReached: number
  totalStudents: number
  funnelPct: number
}> {
  // Keyed by courseId + "::" + chapterTitle to avoid collisions across courses
  // that happen to share the same chapter title.
  const compositeKey = (courseId: string, chapterTitle: string) => `${courseId}::${chapterTitle}`

  const funnelMap = new Map<string, ProgressFunnelItem>()
  for (const f of funnel) funnelMap.set(compositeKey(f.courseId, f.chapterTitle), f)

  const accessMap = new Map<string, ModuleAccessItem>()
  for (const a of access) accessMap.set(compositeKey(a.courseId, a.chapterTitle), a)

  // Union of all composite keys
  const allTitles = new Set([
    ...access.map((a) => compositeKey(a.courseId, a.chapterTitle)),
    ...funnel.map((f) => compositeKey(f.courseId, f.chapterTitle)),
  ])

  const rows: ReturnType<typeof buildCombinedRows> = []
  for (const key of allTitles) {
    const a = accessMap.get(key)
    const f = funnelMap.get(key)
    const totalStudents = f?.totalStudents ?? 0
    const studentsReached = f?.studentsReached ?? 0
    const funnelPct = totalStudents > 0 ? Math.round((studentsReached / totalStudents) * 100) : 0
    // Recover the plain chapter title from either source (strip composite prefix)
    const chapterTitle = a?.chapterTitle ?? f?.chapterTitle ?? key
    const courseId = a?.courseId ?? f?.courseId ?? ""
    rows.push({
      courseId,
      chapterTitle,
      chapterOrder: a?.chapterOrder ?? f?.chapterOrder ?? 0,
      sessionCount: a?.sessionCount ?? 0,
      studentCount: a?.studentCount ?? 0,
      completedCount: a?.completedCount ?? 0,
      studentsReached,
      totalStudents,
      funnelPct,
    })
  }

  return rows.sort((x, y) => x.chapterOrder - y.chapterOrder)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModuleFunnelCombined({
  moduleAccess,
  progressFunnel,
  className = "",
}: ModuleFunnelCombinedProps) {
  const rows = buildCombinedRows(moduleAccess, progressFunnel)

  if (rows.length === 0) return null

  const maxSessions = Math.max(...rows.map((r) => r.sessionCount), 1)

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Módulos — Acesso e Progresso</h3>
          <p className="text-[9px] text-text-muted mt-0.5">
            Barras: nº de sessões · Porcentagem: alunos que alcançaram o módulo
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1 text-[9px] text-text-muted">
            <span className="inline-block h-2 w-4 rounded-sm bg-cerrado-600/70" />
            Sessões
          </span>
          <span className="flex items-center gap-1 text-[9px] text-text-muted">
            <span className="inline-block h-2 w-4 rounded-sm bg-varzea/60" />% Alunos
          </span>
        </div>
      </div>

      {/* Rows */}
      <ul
        className="space-y-3 list-none p-0 m-0"
        aria-label="Módulos — número de sessões e percentual de alunos por módulo"
      >
        {rows.map((row) => {
          const sessionBarW = (row.sessionCount / maxSessions) * 100
          // Color gradient by funnel drop-off (similar heuristic to old funnel)
          const funnelColor =
            row.funnelPct >= 40
              ? "bg-cerrado-600"
              : row.funnelPct >= 20
                ? "bg-cerrado-600/50"
                : "bg-cerrado-600/25"

          return (
            <li key={`${row.courseId}::${row.chapterTitle}`}>
              {/* Module title + funnel badge */}
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] font-medium text-text-primary truncate flex-1">
                  {row.chapterTitle}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Session count */}
                  <span className="text-[10px] font-semibold text-text-primary tabular-nums">
                    {row.sessionCount}
                  </span>
                  {/* Funnel % badge */}
                  {row.totalStudents > 0 && (
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                        row.funnelPct >= 40
                          ? "bg-cerrado-600/10 text-cerrado-600"
                          : row.funnelPct >= 20
                            ? "bg-yellow-500/10 text-yellow-600"
                            : "bg-red-500/10 text-red-500"
                      }`}
                      title={`${row.studentsReached} de ${row.totalStudents} alunos alcançaram este módulo`}
                    >
                      {row.funnelPct}%
                    </span>
                  )}
                </div>
              </div>

              {/* Dual-segment bar: sessions (solid) + funnel pct (translucent overlay) */}
              <div
                aria-hidden="true"
                className="relative h-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden"
              >
                {/* Sessions bar (primary) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-cerrado-600/70 transition-all"
                  style={{ width: `${Math.max(sessionBarW, row.sessionCount > 0 ? 3 : 0)}%` }}
                />
                {/* Funnel bar (secondary, capped to same axis — shows student reach %) */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${funnelColor} opacity-30 transition-all`}
                  style={{
                    width: `${Math.max(row.funnelPct, row.totalStudents > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>

              {/* Sub-label */}
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] text-text-muted">
                  {row.studentCount} aluno{row.studentCount !== 1 ? "s" : ""} com acesso
                </span>
                {row.completedCount > 0 && (
                  <span className="text-[9px] text-semantic-success">
                    {row.completedCount} concluídos
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
