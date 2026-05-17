"use client"

import { Card, CardContent, CardHeader, CardTitle, Input } from "@eximia/ui"
import { ArrowUpDown, BookOpen, ChevronDown, ChevronRight, MessageSquare, Search, Users } from "lucide-react"
import Link from "next/link"
import React, { useMemo, useState } from "react"

export interface RecentReflectionRow {
  slideOrder: number
  chapterTitle: string
  response: string
  createdAt: string
}

export interface RecentSessionRow {
  sessionId?: string
  chapterTitle: string
  interactionType?: string
  status: string
  turns?: number
  createdAt: string
  studentMessages?: string[]
  chapterOrder?: number
}

export interface StudentInsightRow {
  id: string
  full_name: string
  email: string
  lastSessionDate: string | null
  totalSessions: number
  completedSessions: number
  sessionsWithMessages?: number
  totalMessages?: number
  coursesEnrolled: number
  coursesCompleted: number
  reflectionsCount: number
  recentReflections?: RecentReflectionRow[]
  recentSessions?: RecentSessionRow[]
}

interface StudentInsightsTableProps {
  students: StudentInsightRow[]
}

type SortKey = "full_name" | "lastSessionDate" | "totalSessions" | "coursesEnrolled" | "engagement"

function getEngagementScore(s: StudentInsightRow): number {
  return s.completedSessions * 2 + s.reflectionsCount
}
type SortDir = "asc" | "desc"

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca"
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return "Agora"
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffHrs < 24) return `há ${diffHrs}h`
  if (diffDays === 1) return "há 1 dia"
  if (diffDays < 30) return `há ${diffDays} dias`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `há ${months} ${months === 1 ? "mês" : "meses"}`
  }
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function getActivityIndicator(dateStr: string | null): { color: string; label: string } {
  if (!dateStr) return { color: "bg-neutral-500", label: "Inativo" }
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diffDays <= 7) return { color: "bg-semantic-success", label: "Ativo" }
  if (diffDays <= 30) return { color: "bg-accent-gold", label: "Recente" }
  return { color: "bg-semantic-error", label: "Inativo" }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "completed": return "Concluída"
    case "in_progress": return "Em andamento"
    case "started": return "Iniciada"
    default: return status
  }
}

function formatStatusColor(status: string): string {
  switch (status) {
    case "completed": return "text-semantic-success"
    case "in_progress": return "text-accent-gold"
    default: return "text-text-muted"
  }
}

export function StudentInsightsTable({ students }: StudentInsightsTableProps) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("full_name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "full_name" ? "asc" : "desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = students
    if (q) {
      result = students.filter(
        (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      )
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortKey) {
        case "full_name":
          return dir * a.full_name.localeCompare(b.full_name)
        case "lastSessionDate": {
          const aTime = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : 0
          const bTime = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : 0
          return dir * (aTime - bTime)
        }
        case "totalSessions":
          return dir * (a.totalSessions - b.totalSessions)
        case "engagement":
          return dir * (getEngagementScore(a) - getEngagementScore(b))
        case "coursesEnrolled":
          return dir * (a.coursesEnrolled - b.coursesEnrolled)
        default:
          return 0
      }
    })

    return result
  }, [students, search, sortKey, sortDir])

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(colKey)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
    >
      {label}
      <ArrowUpDown
        size={12}
        className={sortKey === colKey ? "text-cerrado-600" : "text-text-muted/40"}
      />
    </button>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Detalhes dos Alunos
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="">
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Nome" colKey="full_name" />
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Email
                  </span>
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Último Acesso" colKey="lastSessionDate" />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="Sessões" colKey="totalSessions" />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="Engajamento" colKey="engagement" />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="Cursos" colKey="coursesEnrolled" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-text-muted">
                    {search ? "Nenhum aluno encontrado para esta busca." : "Nenhum aluno cadastrado."}
                  </td>
                </tr>
              ) : (
                filtered.map((student) => {
                  const activity = getActivityIndicator(student.lastSessionDate)
                  const progress =
                    student.coursesEnrolled > 0
                      ? Math.round((student.coursesCompleted / student.coursesEnrolled) * 100)
                      : 0
                  const isExpanded = expandedId === student.id
                  const hasDetails = (student.recentSessions?.length ?? 0) > 0 || (student.recentReflections?.length ?? 0) > 0

                  return (
                    <React.Fragment key={student.id}>
                      <tr
                        className=" transition-colors hover:bg-bg-hover"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {hasDetails && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : student.id)}
                                className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                            {!hasDetails && <span className="w-[14px]" />}
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : student.id)}
                              className="font-medium text-text-primary hover:text-cerrado-600 transition-colors text-left"
                            >
                              {student.full_name || "Sem nome"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {student.email}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${activity.color}`}
                              title={activity.label}
                            />
                            <span className="text-xs text-text-secondary">
                              {formatRelativeTime(student.lastSessionDate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-text-primary font-medium">
                            {student.completedSessions}
                          </span>
                          <span className="text-text-muted">/{student.totalSessions}</span>
                        </td>
                        {/* Engajamento: score combinado (sessões×2 + reflexões) */}
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const score = getEngagementScore(student)
                            const maxScore = sortedStudents.length > 0 ? Math.max(...sortedStudents.map(getEngagementScore)) : 1
                            const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
                            if (score === 0) return (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-error/10 text-semantic-error font-medium">
                                Sem interação
                              </span>
                            )
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-text-primary font-semibold text-sm">{score}</span>
                                  {score === maxScore && maxScore > 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cerrado-600/10 text-cerrado-600 font-semibold">TOP</span>
                                  )}
                                </div>
                                <div className="w-16 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                                  <div className="h-full rounded-full bg-cerrado-600 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] text-text-muted">{student.completedSessions}s · {student.reflectionsCount}r</span>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-text-primary font-medium">
                            {student.coursesCompleted}
                          </span>
                          <span className="text-text-muted">/{student.coursesEnrolled}</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="">
                          <td colSpan={6} className="px-4 py-4 bg-bg-surface">
                            <div className="grid gap-4 md:grid-cols-2 pl-6">
                              {/* Interações por Módulo (ordered by chapter) */}
                              <div>
                                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                                  <BookOpen size={12} />
                                  Interações por Módulo
                                </h4>
                                {(student.recentSessions?.length ?? 0) === 0 ? (
                                  <p className="text-xs text-text-muted">Nenhuma interação registrada.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {[...student.recentSessions!]
                                      .sort((a, b) => (a.chapterOrder ?? 999) - (b.chapterOrder ?? 999))
                                      .map((session, i) => {
                                      const sessionKey = `${student.id}-${i}`
                                      const isSessionExpanded = expandedSession === sessionKey
                                      const hasMessages = session.studentMessages && session.studentMessages.length > 0
                                      return (
                                        <div key={i} className="rounded-lg bg-bg-surface shadow-card overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSession(isSessionExpanded ? null : sessionKey)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-bg-hover transition-colors"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                {hasMessages && (
                                                  isSessionExpanded
                                                    ? <ChevronDown size={10} className="text-text-muted shrink-0" />
                                                    : <ChevronRight size={10} className="text-text-muted shrink-0" />
                                                )}
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-medium uppercase">
                                                  {session.interactionType === "quiz" ? "Quiz" : session.interactionType === "scenario" ? "Cenário" : session.interactionType === "assignment" ? "Atividade" : "Socrático"}
                                                </span>
                                                <p className="text-xs font-medium text-text-primary truncate">{session.chapterTitle}</p>
                                              </div>
                                              <span className={`text-[10px] font-semibold shrink-0 ${formatStatusColor(session.status)}`}>
                                                {formatStatusLabel(session.status)}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-text-muted">
                                              {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                                              {(session.turns ?? 0) > 0 && ` · ${session.turns} turnos`}
                                              {hasMessages && !isSessionExpanded && ` · ${session.studentMessages!.length} msgs`}
                                            </p>
                                          </button>
                                          {isSessionExpanded && hasMessages && (
                                            <div className="px-3 pb-3 space-y-2 pt-2 bg-bg-surface">
                                              {session.studentMessages!.map((msg, j) => (
                                                <div key={j} className="rounded-md bg-varzea/5 border border-varzea/10 px-3 py-2">
                                                  <p className="text-[11px] text-text-secondary leading-relaxed">
                                                    {msg}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {isSessionExpanded && !hasMessages && (
                                            <div className="px-3 pb-3 pt-2">
                                              <p className="text-[10px] text-text-muted italic">Sem mensagens registradas nesta interação.</p>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              {/* Reflexões por Módulo (grouped by chapter, ordered by slide) */}
                              <div>
                                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                                  <MessageSquare size={12} />
                                  Reflexões por Módulo
                                </h4>
                                {(student.recentReflections?.length ?? 0) === 0 ? (
                                  <p className="text-xs text-text-muted">Nenhuma reflexão registrada.</p>
                                ) : (() => {
                                  // Group reflections by chapter
                                  const grouped = new Map<string, RecentReflectionRow[]>()
                                  const sorted = [...student.recentReflections!].sort((a, b) => a.slideOrder - b.slideOrder)
                                  for (const ref of sorted) {
                                    const list = grouped.get(ref.chapterTitle) ?? []
                                    list.push(ref)
                                    grouped.set(ref.chapterTitle, list)
                                  }
                                  return (
                                    <div className="space-y-3">
                                      {[...grouped.entries()].map(([chapterTitle, refs]) => (
                                        <div key={chapterTitle}>
                                          <p className="text-[10px] font-semibold text-cerrado-600 mb-1.5">
                                            {chapterTitle}
                                            <span className="text-text-muted font-normal ml-1">({refs.length} reflexões)</span>
                                          </p>
                                          <div className="space-y-1 pl-2 border-l-2 border-cerrado-600/20">
                                            {refs.map((ref, i) => (
                                              <div key={i} className="rounded-md bg-bg-surface px-2.5 py-1.5">
                                                <div className="flex items-center justify-between mb-0.5">
                                                  <span className="text-[9px] text-text-muted">Slide {ref.slideOrder}</span>
                                                  <span className="text-[9px] text-text-muted">
                                                    {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                                                  </span>
                                                </div>
                                                <p className="text-[11px] text-text-secondary leading-relaxed">
                                                  {ref.response}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="mt-3 pl-6">
                              <Link
                                href={`/analytics/students/${student.id}`}
                                className="text-xs font-medium text-cerrado-600 hover:text-cerrado-400 transition-colors"
                              >
                                Ver perfil completo &rarr;
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
