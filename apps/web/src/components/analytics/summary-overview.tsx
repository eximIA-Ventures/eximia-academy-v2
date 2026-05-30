"use client"

import { HelpCircle } from "lucide-react"
import { useState } from "react"
import type { UnitStats } from "./unit-comparison"

interface SummaryOverviewProps {
  unitStats: UnitStats[]
  selectedAreaName?: string
}

function aggregateUnits(units: UnitStats[]): UnitStats {
  if (units.length === 0) {
    return {
      areaName: "Total",
      totalStudents: 0,
      activeStudents: 0,
      completedSessions: 0,
      totalSessions: 0,
      reflectionCount: 0,
      avgSessionsPerStudent: 0,
      completionPct: 0,
    }
  }

  const agg: UnitStats = {
    areaName: "Total",
    totalStudents: units.reduce((s, u) => s + u.totalStudents, 0),
    activeStudents: units.reduce((s, u) => s + u.activeStudents, 0),
    completedSessions: units.reduce((s, u) => s + u.completedSessions, 0),
    totalSessions: units.reduce((s, u) => s + u.totalSessions, 0),
    reflectionCount: units.reduce((s, u) => s + u.reflectionCount, 0),
    avgSessionsPerStudent: 0,
    completionPct: 0,
  }

  agg.avgSessionsPerStudent = agg.totalStudents > 0
    ? Number((agg.totalSessions / agg.totalStudents).toFixed(1))
    : 0
  agg.completionPct = agg.totalSessions > 0
    ? Math.round((agg.completedSessions / agg.totalSessions) * 100)
    : 0

  return agg
}

export function SummaryOverview({ unitStats, selectedAreaName }: SummaryOverviewProps) {
  const [showHelp, setShowHelp] = useState(false)

  const stats = selectedAreaName
    ? unitStats.find((u) => u.areaName === selectedAreaName) ?? aggregateUnits(unitStats)
    : aggregateUnits(unitStats)

  const activePct = stats.totalStudents > 0
    ? Math.round((stats.activeStudents / stats.totalStudents) * 100)
    : 0

  const sessionsPct = stats.totalSessions > 0
    ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
    : 0

  // Scale reflections bar relative to total students (avg ~5 reflexões/aluno = 100%)
  const reflBarPct = stats.totalStudents > 0
    ? Math.min(100, Math.round((stats.reflectionCount / (stats.totalStudents * 5)) * 100))
    : 0

  return (
    <div className="relative rounded-2xl bg-white dark:bg-bg-card p-6 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      {/* Help */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-text-muted hover:text-cerrado-600 transition-colors"
        >
          <HelpCircle size={14} />
        </button>
        {showHelp && (
          <div className="absolute right-0 top-6 z-10 w-64 rounded-xl bg-white dark:bg-bg-card border border-gray-100 dark:border-white/10 shadow-lg p-3">
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Visão consolidada {selectedAreaName ? `de ${selectedAreaName}` : "de todas as unidades"}.
              Ativos: alunos com atividade nos últimos 30 dias.
              Conclusão: % de sessões concluídas sobre o total.
              Sess./aluno: média de sessões por aluno no período.
            </p>
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-8">
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">{activePct}%</p>
          <p className="text-[10px] text-text-muted mt-1">Ativos (30d)</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">{stats.completionPct}%</p>
          <p className="text-[10px] text-text-muted mt-1">Conclusão</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-text-primary tabular-nums">
            {typeof stats.avgSessionsPerStudent === "number" ? stats.avgSessionsPerStudent.toFixed(1) : "0.0"}
          </p>
          <p className="text-[10px] text-text-muted mt-1">Sess./aluno</p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-6 mt-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-muted">Sessões</span>
            <span className="text-[10px] font-semibold text-text-primary tabular-nums">
              {stats.completedSessions}/{stats.totalSessions}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-cerrado-600" style={{ width: `${sessionsPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-text-muted">Reflexões</span>
            <span className="text-[10px] font-semibold text-text-primary tabular-nums">
              {stats.reflectionCount}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-varzea" style={{ width: `${reflBarPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
