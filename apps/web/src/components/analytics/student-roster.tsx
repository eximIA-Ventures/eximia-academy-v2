"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { AlertTriangle, CheckCircle, Clock, Mail, Users, XCircle } from "lucide-react"
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

function getRiskConfig(risk: StudentRosterEntry["risk"]) {
  switch (risk) {
    case "on_track":
      return { label: "No ritmo", color: "text-semantic-success", bg: "bg-semantic-success/10", icon: CheckCircle }
    case "at_risk":
      return { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500/10", icon: AlertTriangle }
    case "inactive":
      return { label: "Inativo", color: "text-semantic-error", bg: "bg-semantic-error/10", icon: Clock }
    case "never_accessed":
      return { label: "Nunca acessou", color: "text-semantic-error", bg: "bg-semantic-error/10", icon: XCircle }
  }
}

export function StudentRoster({ students, totalChapters }: StudentRosterProps) {
  const [filter, setFilter] = useState<"all" | "at_risk" | "inactive" | "never_accessed">("all")

  const filtered = filter === "all" ? students : students.filter((s) => s.risk === filter)
  const riskCounts = {
    on_track: students.filter((s) => s.risk === "on_track").length,
    at_risk: students.filter((s) => s.risk === "at_risk").length,
    inactive: students.filter((s) => s.risk === "inactive").length,
    never_accessed: students.filter((s) => s.risk === "never_accessed").length,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Alunos — Visão de Risco
          </CardTitle>
          <span className="text-sm text-text-muted">{students.length} alunos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk summary pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === "all" ? "bg-cerrado-600 text-white" : "bg-bg-elevated text-text-muted hover:text-text-primary"}`}
          >
            Todos ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("at_risk")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === "at_risk" ? "bg-yellow-500 text-white" : "bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20"}`}
          >
            <span className="flex items-center gap-1"><AlertTriangle size={10} /> Atenção ({riskCounts.at_risk})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === "inactive" ? "bg-semantic-error text-white" : "bg-semantic-error/10 text-semantic-error hover:bg-semantic-error/20"}`}
          >
            <span className="flex items-center gap-1"><Clock size={10} /> Inativos ({riskCounts.inactive})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("never_accessed")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${filter === "never_accessed" ? "bg-neutral-700 text-white" : "bg-neutral-500/10 text-neutral-600 hover:bg-neutral-500/20"}`}
          >
            <span className="flex items-center gap-1"><XCircle size={10} /> Nunca acessaram ({riskCounts.never_accessed})</span>
          </button>
        </div>

        {/* Student list */}
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Nenhum aluno nesta categoria.</p>
          ) : (
            filtered.map((student) => {
              const risk = getRiskConfig(student.risk)
              const RiskIcon = risk.icon
              const progressPct = totalChapters > 0 ? Math.round((student.completedChapters / totalChapters) * 100) : 0

              return (
                <div key={student.id} className="flex items-center gap-3 rounded-xl bg-bg-surface px-4 py-3 shadow-card hover:bg-bg-hover transition-colors">
                  {/* Risk indicator */}
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full ${risk.bg} shrink-0`}>
                    <RiskIcon size={14} className={risk.color} />
                  </div>

                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/analytics/students/${student.id}`} className="text-sm font-semibold text-text-primary hover:text-cerrado-600 transition-colors truncate">
                        {student.name}
                      </Link>
                      {student.areaName && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-medium shrink-0">{student.areaName}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted truncate">{student.email}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="flex flex-col items-center gap-0.5 w-20 shrink-0">
                    <div className="w-full h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressPct >= 80 ? "bg-semantic-success" : progressPct >= 40 ? "bg-yellow-500" : "bg-semantic-error/60"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-text-muted tabular-nums">{student.completedChapters}/{totalChapters} cap.</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{student.completedSessions}</p>
                      <p className="text-[9px] text-text-muted">sessões</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{student.reflectionsCount}</p>
                      <p className="text-[9px] text-text-muted">reflexões</p>
                    </div>
                  </div>

                  {/* Last activity */}
                  <div className="text-right shrink-0 w-20">
                    <p className={`text-[10px] font-medium ${risk.color}`}>{risk.label}</p>
                    <p className="text-[9px] text-text-muted">
                      {student.daysSinceLastActivity === null
                        ? "—"
                        : student.daysSinceLastActivity === 0
                          ? "Hoje"
                          : `há ${student.daysSinceLastActivity}d`}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
