"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Building2 } from "lucide-react"

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

  const maxSessions = Math.max(...units.map((u) => u.totalSessions), 1)
  const maxReflections = Math.max(...units.map((u) => u.reflectionCount), 1)

  return (
    <Card>
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
            const sessionBar = Math.round((unit.totalSessions / maxSessions) * 100)
            const reflBar = Math.round((unit.reflectionCount / maxReflections) * 100)

            return (
              <div key={unit.areaName} className="rounded-xl bg-bg-surface p-4 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-text-primary">{unit.areaName}</h4>
                  <span className="text-xs text-text-muted">{unit.totalStudents} alunos</span>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary tabular-nums">{activePct}%</p>
                    <p className="text-[9px] text-text-muted">Ativos (30d)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary tabular-nums">{unit.completionPct}%</p>
                    <p className="text-[9px] text-text-muted">Conclusão</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary tabular-nums">{unit.avgSessionsPerStudent.toFixed(1)}</p>
                    <p className="text-[9px] text-text-muted">Sess./aluno</p>
                  </div>
                </div>

                {/* Bars */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-text-muted">Sessões</span>
                      <span className="text-[10px] font-medium text-text-primary tabular-nums">{unit.completedSessions}/{unit.totalSessions}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-cerrado-600" style={{ width: `${sessionBar}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-text-muted">Reflexões</span>
                      <span className="text-[10px] font-medium text-text-primary tabular-nums">{unit.reflectionCount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-varzea" style={{ width: `${reflBar}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
