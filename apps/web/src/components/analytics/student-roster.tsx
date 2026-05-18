"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Clock, ExternalLink, Mail, Users, X, XCircle } from "lucide-react"
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
  avgSessions?: number
  avgReflections?: number
}

const RISK_CONFIG = {
  on_track: { label: "No ritmo", color: "text-semantic-success", bg: "bg-semantic-success", icon: CheckCircle },
  at_risk: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500", icon: AlertTriangle },
  inactive: { label: "Inativo", color: "text-semantic-error", bg: "bg-semantic-error", icon: Clock },
  never_accessed: { label: "Nunca acessou", color: "text-neutral-500", bg: "bg-neutral-400", icon: XCircle },
}

export function StudentRoster({ students, totalChapters, avgSessions, avgReflections }: StudentRosterProps) {
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterEntry | null>(null)

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
      <CardHeader className="cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <Users size={18} />
            Saúde da Turma
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Compact risk summary always visible */}
            <div className="flex items-center gap-2">
              {counts.on_track > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-semantic-success"><span className="h-2 w-2 rounded-full bg-semantic-success" />{counts.on_track}</span>}
              {counts.at_risk > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-yellow-600"><span className="h-2 w-2 rounded-full bg-yellow-500" />{counts.at_risk}</span>}
              {counts.inactive > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-semantic-error"><span className="h-2 w-2 rounded-full bg-semantic-error" />{counts.inactive}</span>}
              {counts.never_accessed > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-500"><span className="h-2 w-2 rounded-full bg-neutral-400" />{counts.never_accessed}</span>}
            </div>
            <span className="text-sm text-text-muted">{students.length} alunos</span>
          </div>
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="space-y-4">
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
                          <button type="button" onClick={() => setSelectedStudent(student)} className="flex items-center gap-1 hover:text-cerrado-600 transition-colors text-left">
                            <span className="font-medium text-text-primary group-hover:text-cerrado-600">{student.name}</span>
                            <ExternalLink size={10} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            {student.areaName && <span className="ml-1 text-[9px] text-text-muted">{student.areaName}</span>}
                          </button>
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
      </CardContent>}

      {/* Student modal */}
      {selectedStudent && (
        <StudentModal student={selectedStudent} totalChapters={totalChapters} avgSessions={avgSessions} avgReflections={avgReflections} onClose={() => setSelectedStudent(null)} />
      )}
    </Card>
  )
}

function StudentModal({ student, totalChapters, avgSessions, avgReflections, onClose }: { student: StudentRosterEntry; totalChapters: number; avgSessions?: number; avgReflections?: number; onClose: () => void }) {
  const risk = RISK_CONFIG[student.risk]
  const RiskIcon = risk.icon
  const progressPct = totalChapters > 0 ? Math.round((student.completedChapters / totalChapters) * 100) : 0
  const initials = student.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const neverAccessed = student.risk === "never_accessed"

  const sessVsAvg = avgSessions && avgSessions > 0 ? Math.round(((student.completedSessions - avgSessions) / avgSessions) * 100) : null
  const reflVsAvg = avgReflections && avgReflections > 0 ? Math.round(((student.reflectionsCount - avgReflections) / avgReflections) * 100) : null

  // Actionable insight (Norman + Bush)
  const actionMessage = neverAccessed
    ? "Matriculado mas sem nenhuma interação. Considere contato direto."
    : student.risk === "inactive"
      ? `Sem acessar há ${student.daysSinceLastActivity} dias. Estava em ${student.completedChapters}/${totalChapters} módulos quando parou.`
      : student.risk === "at_risk"
        ? `Atividade caindo — último acesso há ${student.daysSinceLastActivity} dias. ${student.totalSessions - student.completedSessions} sessões incompletas.`
        : student.completedChapters === totalChapters
          ? `Completou todos os módulos com ${student.reflectionsCount} reflexões. Aluno exemplar.`
          : `No ritmo — ${student.completedChapters}/${totalChapters} módulos, ${student.completedSessions} sessões concluídas.`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      <div
        className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-white dark:bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <button type="button" onClick={onClose} className="absolute top-4 right-4 h-7 w-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10">
          <X size={14} className="text-gray-500" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-full bg-cerrado-600 flex items-center justify-center text-white font-bold text-base shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-text-primary">{student.name}</h2>
              <p className="text-[11px] text-gray-500">{student.email}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-3">
            <span className={`flex items-center gap-1 text-[11px] px-3 py-1 rounded-full font-semibold ${
              student.risk === "on_track" ? "bg-green-50 text-green-700" :
              student.risk === "at_risk" ? "bg-amber-50 text-amber-700" :
              student.risk === "inactive" ? "bg-red-50 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              <RiskIcon size={11} /> {risk.label}
            </span>
            {student.areaName && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">{student.areaName}</span>
            )}
            <span className="text-[11px] text-gray-400 ml-auto">
              {student.daysSinceLastActivity === null ? "Nunca acessou" : student.daysSinceLastActivity === 0 ? "Ativo hoje" : `há ${student.daysSinceLastActivity}d`}
            </span>
          </div>
        </div>

        {/* Actionable insight (Norman + Bush) */}
        <div className="mx-6 mb-4 rounded-xl bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
          <p className="text-[11px] text-gray-700 dark:text-text-secondary leading-relaxed">{actionMessage}</p>
          {(student.risk === "inactive" || student.risk === "at_risk" || student.risk === "never_accessed") && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/notifications/nudge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ studentId: student.id, studentName: student.name, studentEmail: student.email }),
                  })
                  alert(`Lembrete enviado para ${student.name}`)
                } catch {
                  alert("Erro ao enviar lembrete")
                }
              }}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-cerrado-600 hover:text-cerrado-700 transition-colors"
            >
              <Mail size={12} /> Enviar lembrete por email
            </button>
          )}
        </div>

        {neverAccessed ? (
          <div className="px-6 pb-6" />
        ) : (
          <>
            {/* Stats 2x2 grid (Schoger) */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Sessões", value: student.completedSessions, total: student.totalSessions, vsAvg: sessVsAvg },
                  { label: "Reflexões", value: student.reflectionsCount, vsAvg: reflVsAvg },
                  { label: "Módulos", value: student.completedChapters, total: totalChapters },
                  { label: "Progresso", value: `${progressPct}%`, isPct: true },
                ].map((s) => (
                  <div key={s.label} className="border border-gray-100 dark:border-border-subtle rounded-xl p-3.5">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-text-primary tabular-nums leading-none">
                      {s.isPct ? s.value : <>{s.value}{s.total !== undefined && <span className="text-sm text-gray-400 font-normal">/{s.total}</span>}</>}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
                    {!s.isPct && s.vsAvg !== null && s.vsAvg !== undefined && (
                      <p className={`text-[10px] font-semibold mt-0.5 ${(s.vsAvg as number) >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {(s.vsAvg as number) >= 0 ? "↑" : "↓"} {Math.abs(s.vsAvg as number)}% vs turma
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mx-6 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Progresso geral</span>
                <span className="text-xs font-bold text-cerrado-600 tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${progressPct >= 80 ? "bg-green-500" : progressPct >= 40 ? "bg-amber-500" : "bg-cerrado-600"}`} style={{ width: `${Math.max(progressPct, 2)}%` }} />
              </div>
            </div>
          </>
        )}

        <div className="h-3 sm:h-1" />
      </div>
    </div>
  )
}
