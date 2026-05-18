"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { ArrowUp, Building2, Crown } from "lucide-react"

export interface UnitStats {
  areaName: string
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
}

interface UnitComparisonProps {
  units: UnitStats[]
}

export function UnitComparison({ units }: UnitComparisonProps) {
  if (units.length < 2) return null

  // Determine winner per metric
  const bestActive = units.reduce((a, b) => (a.activeStudents / Math.max(a.totalStudents, 1)) > (b.activeStudents / Math.max(b.totalStudents, 1)) ? a : b)
  const bestCompletion = units.reduce((a, b) => a.completionPct > b.completionPct ? a : b)
  const bestSessPerStudent = units.reduce((a, b) => a.avgSessionsPerStudent > b.avgSessionsPerStudent ? a : b)
  const bestReflections = units.reduce((a, b) => a.reflectionCount > b.reflectionCount ? a : b)

  // Overall score (wins count)
  function winsCount(u: UnitStats) {
    let w = 0
    if (u.areaName === bestActive.areaName) w++
    if (u.areaName === bestCompletion.areaName) w++
    if (u.areaName === bestSessPerStudent.areaName) w++
    if (u.areaName === bestReflections.areaName) w++
    return w
  }

  const overallBest = units.reduce((a, b) => winsCount(a) > winsCount(b) ? a : b)

  return (
    <Card className="dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 size={18} />
          Comparação entre Unidades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {units.map((unit) => {
            const activePct = unit.totalStudents > 0 ? Math.round((unit.activeStudents / unit.totalStudents) * 100) : 0
            const isOverallBest = unit.areaName === overallBest.areaName
            const isActiveWinner = unit.areaName === bestActive.areaName
            const isCompletionWinner = unit.areaName === bestCompletion.areaName
            const isSessWinner = unit.areaName === bestSessPerStudent.areaName
            const isReflWinner = unit.areaName === bestReflections.areaName

            return (
              <div key={unit.areaName} className={`rounded-2xl p-5 space-y-4 ${isOverallBest ? "bg-cerrado-600/[0.04] ring-1 ring-cerrado-600/10" : "bg-gray-50 dark:bg-white/[0.04] dark:border dark:border-white/[0.06]"}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary">{unit.areaName}</h4>
                    {isOverallBest && <Crown size={14} className="text-cerrado-600" />}
                  </div>
                  <span className="text-[10px] text-text-muted font-medium">{unit.totalStudents} alunos</span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <MetricCell value={`${activePct}%`} label="Ativos (30d)" isWinner={isActiveWinner} />
                  <MetricCell value={`${unit.completionPct}%`} label="Conclusão" isWinner={isCompletionWinner} />
                  <MetricCell value={unit.avgSessionsPerStudent.toFixed(1)} label="Sess./aluno" isWinner={isSessWinner} />
                </div>

                {/* Bars */}
                <div className="grid grid-cols-2 gap-3">
                  <BarMetric label="Sessões" value={unit.completedSessions} total={unit.totalSessions} isWinner={false} color="bg-cerrado-600" maxValue={Math.max(...units.map((u) => u.totalSessions), 1)} current={unit.totalSessions} />
                  <BarMetric label="Reflexões" value={unit.reflectionCount} isWinner={isReflWinner} color="bg-varzea" maxValue={Math.max(...units.map((u) => u.reflectionCount), 1)} current={unit.reflectionCount} />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCell({ value, label, isWinner }: { value: string; label: string; isWinner: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <p className={`text-lg font-bold tabular-nums ${isWinner ? "text-cerrado-600" : "text-text-primary"}`}>{value}</p>
        {isWinner && <ArrowUp size={12} className="text-cerrado-600" />}
      </div>
      <p className="text-[9px] text-text-muted">{label}</p>
    </div>
  )
}

function BarMetric({ label, value, total, isWinner, color, maxValue, current }: { label: string; value: number; total?: number; isWinner: boolean; color: string; maxValue: number; current: number }) {
  const pct = maxValue > 0 ? (current / maxValue) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted">{label}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${isWinner ? "text-cerrado-600" : "text-text-primary"}`}>
          {total !== undefined ? `${value}/${total}` : value}
          {isWinner && " ★"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
