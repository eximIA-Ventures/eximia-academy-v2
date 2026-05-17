"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { AlertTriangle, CheckCircle, Clock, ExternalLink, Users, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export interface StudentRosterEntry {
  id: string
  name: string
  email: string
  areaName: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  lastActivityDate: string | null
  daysSinceLastActivity: number | null
  completedChapters: number
  totalChapters: number
  risk: "on_track" | "at_risk" | "inactive" | "never_accessed"
}

interface StudentRosterProps {
  students: StudentRosterEntry[]
  totalChapters: number
}

const RISK_CONFIG = {
  on_track: { label: "No ritmo", color: "text-semantic-success", bg: "bg-semantic-success", icon: CheckCircle },
  at_risk: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500", icon: AlertTriangle },
  inactive: { label: "Inativo", color: "text-semantic-error", bg: "bg-semantic-error", icon: Clock },
  never_accessed: { label: "Nunca acessou", color: "text-neutral-500", bg: "bg-neutral-400", icon: XCircle },
}

export function StudentRoster({ students, totalChapters }: StudentRosterProps) {
  const [showAll, setShowAll] = useState(false)

  const counts = {
    on_track: students.filter((s) => s.risk === "on_track").length,
    at_risk: students.filter((s) => s.risk === "at_risk").length,
    inactive: students.filter((s) => s.risk === "inactive").length,
    never_accessed: students.filter((s) => s.risk === "never_accessed").length,
  }

  // Only show students that need attention by default
  const needsAttention = students.filter((s) => s.risk !== "on_track")
  const displayList = showAll ? students : needsAttention

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Saúde da Turma
          </CardTitle>
          <span className="text-sm text-text-muted">{students.length} alunos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk distribution — compact horizontal bar */}
        <div className="space-y-2">
          <div className="flex h-3 rounded-full overflow-hidden">
            {counts.on_track > 0 && <div className="bg-semantic-success" style={{ width: `${(counts.on_track / students.length) * 100}%` }} />}
            {counts.at_risk > 0 && <div className="bg-yellow-500" style={{ width: `${(counts.at_risk / students.length) * 100}%` }} />}
            {counts.inactive > 0 && <div className="bg-semantic-error" style={{ width: `${(counts.inactive / students.length) * 100}%` }} />}
            {counts.never_accessed > 0 && <div className="bg-neutral-300" style={{ width: `${(counts.never_accessed / students.length) * 100}%` }} />}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {([["on_track", counts.on_track], ["at_risk", counts.at_risk], ["inactive", counts.inactive], ["never_accessed", counts.never_accessed]] as const)
              .filter(([, count]) => count > 0)
              .map(([risk, count]) => (
                <div key={risk} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${RISK_CONFIG[risk].bg}`} />
                  <span className="text-xs text-text-muted">{RISK_CONFIG[risk].label}</span>
                  <span className="text-xs font-semibold text-text-primary">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Students that need attention — compact table */}
        {needsAttention.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {showAll ? "Todos os alunos" : "Precisam de atenção"}
              </p>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-[10px] text-cerrado-600 hover:text-cerrado-400 font-medium"
              >
                {showAll ? "Só atenção" : `Ver todos (${students.length})`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Aluno</th>
                    <th className="pb-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">Progresso</th>
                    <th className="pb-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">Sessões</th>
                    <th className="pb-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">Reflexões</th>
                    <th className="pb-2 text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((student) => {
                    const risk = RISK_CONFIG[student.risk]
                    const progressPct = totalChapters > 0 ? Math.round((student.completedChapters / totalChapters) * 100) : 0
                    return (
                      <tr key={student.id} className="hover:bg-bg-hover/50 transition-colors group">
                        <td className="py-2.5 pr-2">
                          <Link href={`/analytics/students/${student.id}`} className="flex items-center gap-1 hover:text-cerrado-600 transition-colors">
                            <span className="font-medium text-text-primary group-hover:text-cerrado-600">{student.name}</span>
                            <ExternalLink size={10} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            {student.areaName && <span className="ml-1 text-[9px] text-text-muted">{student.areaName}</span>}
                          </Link>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-14 h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressPct >= 80 ? "bg-semantic-success" : progressPct >= 40 ? "bg-yellow-500" : "bg-semantic-error/60"}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-text-muted tabular-nums">{progressPct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center tabular-nums text-text-primary">{student.completedSessions}</td>
                        <td className="py-2.5 text-center tabular-nums text-text-primary">{student.reflectionsCount}</td>
                        <td className="py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${risk.color}`}>
                            {student.daysSinceLastActivity === null ? "—" : student.daysSinceLastActivity === 0 ? "Hoje" : `${student.daysSinceLastActivity}d`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {needsAttention.length === 0 && (
          <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-semantic-success/5 border border-semantic-success/10">
            <CheckCircle size={16} className="text-semantic-success" />
            <p className="text-sm text-semantic-success font-medium">Todos os alunos estão no ritmo!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
