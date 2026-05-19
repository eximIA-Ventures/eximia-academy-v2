"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  Activity,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Star,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react"
import { useState } from "react"

interface ChapterSession {
  id: string
  status: string
  turns: number
  createdAt: string
  messages: string[]
  depth: number | null
}

interface ProfileData {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
  areaName: string | null
  memberSince: string
  lastActivityDate: string | null
  daysSinceLastActivity: number | null
  totalSessions: number
  completedSessions: number
  totalReflections: number
  avgWordsPerReflection: number
  uniqueChapters: number
  totalMessages: number
  enrollments: Array<{
    courseTitle: string
    status: string
    enrolledAt: string
    completedAt: string | null
  }>
  sessionsByWeek: Array<{ week: string; count: number }>
  chapterSessions: Array<{
    chapterTitle: string
    chapterOrder: number
    interactionType: string
    sessions: ChapterSession[]
  }>
  chapterReflections: Array<{
    chapterTitle: string
    reflections: Array<{
      slideOrder: number
      response: string
      aiResponse: string | null
      createdAt: string
    }>
  }>
  depthProgression: Array<{ date: string; depth: number; chapter: string }>
  gamification: { xp: number; level: number; currentStreak: number; maxStreak: number } | null
  assessments: Array<{ type: string; results: unknown; createdAt: string }>
}

const MODE_LABELS: Record<string, string> = {
  socratic_dialogue: "Socrático",
  quiz: "Quiz",
  scenario: "Cenário",
  assignment: "Atividade",
}

export function StudentFullProfile({ data }: { data: ProfileData }) {
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)
  const [expandedReflChapter, setExpandedReflChapter] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const initials = data.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  const maxWeek = Math.max(...data.sessionsByWeek.map((w) => w.count), 1)
  const engagementScore = data.completedSessions * 2 + data.totalReflections

  return (
    <div className="space-y-6">
      {/* Header — student identity */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-cerrado-600/10 flex items-center justify-center text-cerrado-600 font-bold text-xl shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text-primary">{data.fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <Mail size={13} /> {data.email}
                </span>
                {data.areaName && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {data.areaName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> Membro desde {data.memberSince}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {data.daysSinceLastActivity === null
                    ? "Nunca acessou"
                    : data.daysSinceLastActivity === 0
                      ? "Ativo hoje"
                      : `Último acesso há ${data.daysSinceLastActivity} dias`}
                </span>
              </div>
            </div>
            {data.gamification && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-cerrado-600">
                    <Trophy size={16} />
                    <span className="text-lg font-bold">{data.gamification.xp}</span>
                  </div>
                  <span className="text-[9px] text-text-muted">
                    XP · Nível {data.gamification.level}
                  </span>
                </div>
                {data.gamification.currentStreak > 0 && (
                  <div className="text-center ml-3">
                    <div className="flex items-center gap-1 text-yellow-600">
                      <Zap size={16} />
                      <span className="text-lg font-bold">{data.gamification.currentStreak}</span>
                    </div>
                    <span className="text-[9px] text-text-muted">Streak</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          {
            icon: Activity,
            label: "Sessões",
            value: `${data.completedSessions}/${data.totalSessions}`,
            color: "text-cerrado-600",
          },
          {
            icon: MessageSquare,
            label: "Reflexões",
            value: data.totalReflections,
            color: "text-varzea",
          },
          { icon: BookOpen, label: "Módulos", value: data.uniqueChapters, color: "text-[#8b5cf6]" },
          {
            icon: GraduationCap,
            label: "Cursos",
            value: data.enrollments.length,
            color: "text-yellow-600",
          },
          {
            icon: TrendingUp,
            label: "Engajamento",
            value: engagementScore,
            color: "text-cerrado-600",
          },
          {
            icon: Star,
            label: "Palavras/Refl.",
            value: data.avgWordsPerReflection,
            color: "text-text-primary",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white dark:bg-bg-card p-4 shadow-card text-center"
          >
            <stat.icon size={18} className={`mx-auto mb-1 ${stat.color}`} />
            <p className="text-xl font-bold text-text-primary">{stat.value}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Activity trend + Enrollments */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity trend */}
        <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Atividade Semanal</h3>
          <div className="flex items-end gap-1.5" style={{ height: 100 }}>
            {data.sessionsByWeek.map((w, i) => {
              const h = maxWeek > 0 ? (w.count / maxWeek) * 100 : 0
              const isLast = i === data.sessionsByWeek.length - 1
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end"
                >
                  {w.count > 0 && (
                    <span className="text-[8px] font-bold text-text-primary tabular-nums">
                      {w.count}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t-md ${isLast ? "bg-cerrado-600" : w.count > 0 ? "bg-cerrado-600/40" : "bg-black/[0.04]"}`}
                    style={{ height: `${Math.max(h, w.count > 0 ? 10 : 4)}%` }}
                  />
                  <span className="text-[7px] text-text-muted">{w.week}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Enrollments */}
        <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Cursos Matriculados</h3>
          {data.enrollments.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhuma matrícula.</p>
          ) : (
            <div className="space-y-2">
              {data.enrollments.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-xs font-medium text-text-primary">{e.courseTitle}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.status === "completed" ? "bg-semantic-success/10 text-semantic-success" : "bg-yellow-500/10 text-yellow-600"}`}
                  >
                    {e.status === "completed" ? "Concluído" : "Em andamento"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Depth analytics — Distribution + Evolution */}
      {data.depthProgression.length > 0 && (() => {
        const DEPTH_LABELS = [
          "Repetição superficial",
          "Compreensão básica",
          "Aplicação",
          "Análise",
          "Questionamento",
          "Síntese",
          "Insight original",
        ]
        const DEPTH_COLORS = [
          "bg-gray-300",
          "bg-blue-400",
          "bg-blue-500",
          "bg-purple-500",
          "bg-amber-600",
          "bg-emerald-500",
          "bg-emerald-600",
        ]
        // Distribution: count sessions at each depth level
        const distribution = Array(7).fill(0) as number[]
        for (const d of data.depthProgression) {
          if (d.depth >= 1 && d.depth <= 7) distribution[d.depth - 1]++
        }
        const maxCount = Math.max(...distribution, 1)
        const totalSessions = data.depthProgression.length

        // Weekly averages
        const weekMap = new Map<string, number[]>()
        for (const d of data.depthProgression) {
          const parts = d.date.split("/")
          const dateObj = new Date(+parts[2], +parts[1] - 1, +parts[0])
          const weekStart = new Date(dateObj)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const key = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`
          const list = weekMap.get(key) ?? []
          list.push(d.depth)
          weekMap.set(key, list)
        }
        const weeklyAvg = [...weekMap.entries()]
          .map(([week, depths]) => ({ week, avg: Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 }))
          .slice(-8)
        const maxAvg = Math.max(...weeklyAvg.map((w) => w.avg), 1)

        return (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Depth distribution */}
            <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Distribuição de Profundidade</h3>
                <span className="text-xs text-text-muted">{totalSessions} sessões</span>
              </div>
              <div className="space-y-2">
                {DEPTH_LABELS.map((label, i) => {
                  const count = distribution[i]
                  const pct = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0
                  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[11px] text-text-secondary w-[140px] text-right shrink-0">{label}</span>
                      <div className="flex-1 h-5 rounded-md bg-black/[0.03] overflow-hidden">
                        <div className={`h-full rounded-md ${DEPTH_COLORS[i]} transition-all`} style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-text-primary tabular-nums w-6 text-right">{count}</span>
                      <span className="text-[10px] text-text-muted w-10 text-right">({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Depth evolution by week */}
            <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Evolução da Profundidade</h3>
                <p className="text-[10px] text-text-muted">Profundidade média por semana (escala 1-7)</p>
              </div>
              {weeklyAvg.length > 0 ? (
                <div className="flex items-end gap-2" style={{ height: 120 }}>
                  {weeklyAvg.map((w, i) => {
                    const h = maxAvg > 0 ? (w.avg / 7) * 100 : 0
                    const isLast = i === weeklyAvg.length - 1
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[9px] font-bold text-text-primary tabular-nums">{w.avg}</span>
                        <div
                          className={`w-full rounded-t-md ${isLast ? "bg-[#8b5cf6]" : "bg-[#8b5cf6]/50"}`}
                          style={{ height: `${Math.max(h, 8)}%` }}
                        />
                        <span className="text-[8px] text-text-muted">{w.week}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted py-4 text-center">Dados insuficientes.</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Depth per session (detailed) */}
      {data.depthProgression.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Profundidade por Sessão</h3>
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {data.depthProgression.map((d, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end"
                title={`${d.chapter} — ${d.date} — Profundidade ${d.depth}/7`}
              >
                <span className="text-[7px] font-bold text-text-primary">{d.depth}</span>
                <div
                  className="w-full rounded-t-sm bg-[#8b5cf6]"
                  style={{ height: `${(d.depth / 7) * 100}%`, opacity: 0.4 + (d.depth / 7) * 0.6 }}
                />
              </div>
            ))}
          </div>
          <p className="text-[9px] text-text-muted">
            Escala 1-7 · Cada barra = 1 sessão · Hover para ver módulo e data
          </p>
        </div>
      )}

      {/* Sessions by chapter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen size={18} /> Interações por Módulo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.chapterSessions.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">
              Nenhuma interação registrada.
            </p>
          ) : (
            data.chapterSessions.map((ch) => {
              const isExpanded = expandedChapter === ch.chapterTitle
              const completed = ch.sessions.filter((s) => s.status === "completed").length
              return (
                <div
                  key={ch.chapterTitle}
                  className="rounded-xl bg-bg-surface shadow-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedChapter(isExpanded ? null : ch.chapterTitle)}
                    className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-cerrado-600" />
                        ) : (
                          <ChevronRight size={14} className="text-text-muted" />
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-medium uppercase">
                          {MODE_LABELS[ch.interactionType] ?? ch.interactionType}
                        </span>
                        <span className="text-sm font-semibold text-text-primary">
                          {ch.chapterTitle}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">
                        {completed}/{ch.sessions.length} concluídas
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-border-subtle pt-2">
                      {ch.sessions.map((s) => {
                        const isSessExpanded = expandedSession === s.id
                        return (
                          <div key={s.id} className="rounded-lg bg-bg-card overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedSession(isSessExpanded ? null : s.id)}
                              className="w-full text-left px-3 py-2 hover:bg-bg-hover transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {s.messages.length > 0 &&
                                    (isSessExpanded ? (
                                      <ChevronDown size={10} className="text-text-muted" />
                                    ) : (
                                      <ChevronRight size={10} className="text-text-muted" />
                                    ))}
                                  <span className="text-[10px] text-text-muted">
                                    {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    · {s.turns} turnos
                                  </span>
                                  {s.depth && (
                                    <span className="text-[10px] text-[#8b5cf6] font-medium">
                                      · Profundidade {s.depth}/7
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[9px] font-semibold ${s.status === "completed" ? "text-semantic-success" : "text-yellow-600"}`}
                                >
                                  {s.status === "completed" ? "Concluída" : "Em andamento"}
                                </span>
                              </div>
                            </button>
                            {isSessExpanded && s.messages.length > 0 && (
                              <div className="px-3 pb-2 space-y-1">
                                {s.messages.map((msg, j) => (
                                  <div
                                    key={j}
                                    className="rounded-md bg-varzea/5 border border-varzea/10 px-3 py-1.5"
                                  >
                                    <p className="text-[10px] text-text-secondary">{msg}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Reflections by chapter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare size={18} /> Reflexões e Respostas por Módulo
            </CardTitle>
            <span className="text-xs text-text-muted">{data.totalReflections} contribuições</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.chapterReflections.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Nenhuma reflexão registrada.</p>
          ) : (
            data.chapterReflections.map((ch) => {
              const isExpanded = expandedReflChapter === ch.chapterTitle
              return (
                <div
                  key={ch.chapterTitle}
                  className="rounded-xl bg-bg-surface shadow-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedReflChapter(isExpanded ? null : ch.chapterTitle)}
                    className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-cerrado-600" />
                        ) : (
                          <ChevronRight size={14} className="text-text-muted" />
                        )}
                        <BookOpen size={14} className="text-cerrado-600" />
                        <span className="text-sm font-semibold text-text-primary">
                          {ch.chapterTitle}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">
                        {ch.reflections.length} reflexões
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-border-subtle pt-2 space-y-1.5 pl-6 border-l-2 border-cerrado-600/20 ml-4">
                      {ch.reflections.map((ref, i) => (
                        <div key={i} className="rounded-md bg-bg-card px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-cerrado-600">
                              {ref.aiResponse != null
                                ? `Slide ${ref.slideOrder}`
                                : `Resposta ${ref.slideOrder}`}
                            </span>
                            <span className="text-[9px] text-text-muted">
                              {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            {ref.response}
                          </p>
                          {ref.aiResponse && (
                            <div className="mt-1.5 pt-1.5 border-t border-border-subtle">
                              <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">
                                Resposta da IA
                              </p>
                              <p className="text-[10px] text-text-muted leading-relaxed">
                                {(ref.aiResponse as string).slice(0, 200)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Assessments */}
      {data.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={18} /> Avaliações Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.assessments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-surface"
                >
                  <span className="text-xs font-medium text-text-primary capitalize">
                    {a.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
