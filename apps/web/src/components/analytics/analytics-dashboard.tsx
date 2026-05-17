"use client"

import { Select } from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Activity, BookOpen, GraduationCap, Search, Users } from "lucide-react"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import type { AggregateAnalyticsResponse } from "@/types/analytics"
import { AlertAttentionList } from "./alert-attention-list"
import { CognitivePatternsChart } from "./cognitive-patterns-chart"
import { DepthDistributionChart } from "./depth-distribution-chart"
import { DivergenceComparisonTable } from "./divergence-comparison-table"
import { EmotionalJourneyChart } from "./emotional-journey-chart"
import { KolbTeamScatter } from "./kolb-team-scatter"
import { SummaryCardsRow } from "./summary-cards-row"
import { ReflectionAnalytics, type ModuleReflectionStats } from "./reflection-analytics"
import { StudentRoster, type StudentRosterEntry } from "./student-roster"
import { UnitComparison, type UnitStats } from "./unit-comparison"

export interface SessionsByWeek {
  week: string
  count: number
}

export interface ModuleAccess {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  sessionCount: number
  completedCount: number
  studentCount: number
}

export interface InteractionModeBreakdown {
  mode: string
  label: string
  count: number
}

export interface ProgressFunnel {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  studentsReached: number
  totalStudents: number
}

interface AnalyticsDashboardProps {
  initialData: AggregateAnalyticsResponse
  courses: Array<{ id: string; title: string }>
  areas: Array<{ id: string; name: string }>
  initialAreaId?: string
  moduleStats?: ModuleReflectionStats[]
  totalReflections?: number
  totalStudents?: number
  rosterStudents?: StudentRosterEntry[]
  totalChapters?: number
  unitStats?: UnitStats[]
  sessionsByWeek?: SessionsByWeek[]
  moduleAccess?: ModuleAccess[]
  interactionModes?: InteractionModeBreakdown[]
  progressFunnel?: ProgressFunnel[]
}

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
]

type Tab = "uso" | "aprendizagem" | "alunos"

const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "uso", label: "Uso da Plataforma", icon: Activity },
  { id: "aprendizagem", label: "Aprendizagem", icon: BookOpen },
  { id: "alunos", label: "Alunos", icon: Users },
]

export function AnalyticsDashboard({
  initialData,
  courses,
  areas,
  initialAreaId,
  moduleStats = [],
  totalReflections = 0,
  totalStudents = 0,
  rosterStudents = [],
  totalChapters = 0,
  unitStats = [],
  sessionsByWeek = [],
  moduleAccess = [],
  interactionModes = [],
  progressFunnel = [],
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uso")
  const [period, setPeriod] = useState("30d")
  const [courseId, setCourseId] = useState("")
  const [areaId, setAreaId] = useState(initialAreaId ?? "")
  const [interactionType, setInteractionType] = useState("")
  const [studentSearch, setStudentSearch] = useState("")

  const { data, isLoading, isError } = useQuery<AggregateAnalyticsResponse>({
    queryKey: ["analytics-aggregate", period, courseId, areaId, interactionType],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (courseId) params.set("courseId", courseId)
      if (areaId) params.set("areaId", areaId)
      if (interactionType) params.set("interactionType", interactionType)
      const r = await fetch(`/api/analytics/aggregate?${params.toString()}`)
      if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData: period === "30d" && !courseId && !areaId && !interactionType ? initialData : undefined,
  })

  const currentData = data ?? initialData
  const isFetching = isLoading && !data

  const searchLower = studentSearch.toLowerCase()
  const isSearching = searchLower.length > 1

  const filteredRoster = useMemo(() => {
    if (!isSearching) return rosterStudents
    return rosterStudents.filter((s) => s.name.toLowerCase().includes(searchLower) || s.email.toLowerCase().includes(searchLower))
  }, [rosterStudents, searchLower, isSearching])

  const filteredModuleStats = useMemo(() => {
    if (!isSearching) return moduleStats
    return moduleStats.map((mod) => ({
      ...mod,
      reflections: (mod.reflections ?? []).filter((r) => r.studentName.toLowerCase().includes(searchLower)),
      reflectionCount: (mod.reflections ?? []).filter((r) => r.studentName.toLowerCase().includes(searchLower)).length,
    }))
  }, [moduleStats, searchLower, isSearching])

  const filteredTotalReflections = isSearching
    ? filteredModuleStats.reduce((sum, m) => sum + m.reflectionCount, 0)
    : totalReflections

  // Class averages for comparison
  const avgSessions = rosterStudents.length > 0 ? rosterStudents.reduce((sum, s) => sum + s.completedSessions, 0) / rosterStudents.length : 0
  const avgReflections = rosterStudents.length > 0 ? rosterStudents.reduce((sum, s) => sum + s.reflectionsCount, 0) / rosterStudents.length : 0

  // Client-side course filter for usage tab data
  const filteredModuleAccess = useMemo(() => {
    if (!courseId) return moduleAccess
    return moduleAccess.filter((m) => m.courseId === courseId)
  }, [moduleAccess, courseId])

  const filteredProgressFunnel = useMemo(() => {
    if (!courseId) return progressFunnel
    return progressFunnel.filter((f) => f.courseId === courseId)
  }, [progressFunnel, courseId])

  // Recompute interaction modes from filtered modules
  const filteredInteractionModes = useMemo(() => {
    if (!courseId) return interactionModes
    const chapterIds = new Set(filteredModuleAccess.map((m) => m.chapterTitle))
    // Can't filter by chapterId without mapping, so return all modes when course filtered
    return interactionModes
  }, [interactionModes, courseId, filteredModuleAccess])

  const maxModuleSessions = Math.max(...filteredModuleAccess.map((m) => m.sessionCount), 1)
  const totalInteractions = filteredInteractionModes.reduce((sum, m) => sum + m.count, 0)

  return (
    <div className="space-y-6">
      {/* Tab navigation + filters — single row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-bg-card p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-cerrado-600 text-white shadow-md"
                    : "text-text-secondary hover:text-text-primary hover:bg-black/[0.03]"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "alunos" && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-52 rounded-xl bg-white dark:bg-bg-card pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] focus:outline-none focus:shadow-[0_2px_12px_rgba(224,122,47,0.15),0_0_0_2px_rgba(224,122,47,0.3)] transition-shadow"
              />
              {isSearching && (
                <button type="button" onClick={() => setStudentSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cerrado-600 font-medium">Limpar</button>
              )}
            </div>
          )}
          {/* Course filter — pill buttons */}
          <div className="flex items-center gap-1 rounded-xl bg-white dark:bg-bg-card p-0.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={() => setCourseId("")}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${!courseId ? "bg-cerrado-600 text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              Todos os cursos
            </button>
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseId(courseId === c.id ? "" : c.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all truncate max-w-[200px] ${courseId === c.id ? "bg-cerrado-600 text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
              >
                {c.title}
              </button>
            ))}
          </div>
          <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>
      </div>

      {isFetching && <p className="text-center text-sm text-text-muted">Carregando dados...</p>}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">Falha ao carregar dados.</div>
      )}

      {/* ═══════════════════ TAB: USO DA PLATAFORMA ═══════════════════ */}
      {activeTab === "uso" && (
        <div className="space-y-6">
          <SummaryCardsRow summary={currentData.summary} />

          {unitStats.length >= 2 && <UnitComparison units={unitStats} />}

          {/* Sessions per week trend */}
          {sessionsByWeek.length > 0 && (() => {
            const maxWeek = Math.max(...sessionsByWeek.map((s) => s.count), 1)
            const totalWeekSessions = sessionsByWeek.reduce((s, w) => s + w.count, 0)
            return (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">Sessões por Semana</h3>
                  <span className="text-xs text-text-muted">{totalWeekSessions} sessões em 12 semanas</span>
                </div>
                <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                  {sessionsByWeek.map((w, i) => {
                    const hPct = maxWeek > 0 ? (w.count / maxWeek) * 100 : 0
                    const isLast = i === sessionsByWeek.length - 1
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        {w.count > 0 && <span className="text-[9px] font-bold text-text-primary tabular-nums">{w.count}</span>}
                        <div
                          className={`w-full rounded-t-lg transition-all ${isLast ? "bg-cerrado-600" : w.count > 0 ? "bg-cerrado-600/50" : "bg-black/[0.04]"}`}
                          style={{ height: `${Math.max(hPct, w.count > 0 ? 8 : 3)}%` }}
                        />
                        <span className={`text-[8px] tabular-nums ${isLast ? "text-cerrado-600 font-semibold" : "text-text-muted"}`}>{w.week}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Module access + Interaction modes + Funnel — 3 cards */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Module ranking */}
            {filteredModuleAccess.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Módulos Mais Acessados</h3>
                <div className="space-y-3">
                  {[...filteredModuleAccess].sort((a, b) => b.sessionCount - a.sessionCount).map((mod, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-text-primary truncate">{mod.chapterTitle}</span>
                        <span className="text-[10px] font-semibold text-text-primary tabular-nums shrink-0 ml-2">{mod.sessionCount}</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                        <div className="h-full rounded-full bg-cerrado-600" style={{ width: `${(mod.sessionCount / maxModuleSessions) * 100}%`, opacity: 0.4 + ((maxModuleSessions - i * (maxModuleSessions / moduleAccess.length)) / maxModuleSessions) * 0.6 }} />
                      </div>
                      <span className="text-[9px] text-text-muted">{mod.studentCount} alunos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interaction modes — donut-style list */}
            {filteredInteractionModes.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Modos de Interação</h3>
                <div className="space-y-3">
                  {filteredInteractionModes.map((mode) => {
                    const pct = totalInteractions > 0 ? Math.round((mode.count / totalInteractions) * 100) : 0
                    const colors: Record<string, string> = { socratic_dialogue: "bg-cerrado-600", quiz: "bg-varzea", scenario: "bg-yellow-500", assignment: "bg-[#8b5cf6]" }
                    return (
                      <div key={mode.mode}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${colors[mode.mode] ?? "bg-neutral-400"}`} />
                            <span className="text-[11px] font-medium text-text-primary">{mode.label}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-text-primary tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                          <div className={`h-full rounded-full ${colors[mode.mode] ?? "bg-neutral-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-text-muted">{mode.count} sessões</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Progress funnel */}
            {filteredProgressFunnel.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Funil de Progresso</h3>
                <p className="text-[9px] text-text-muted">Alunos que acessaram cada módulo</p>
                <div className="space-y-2">
                  {[...filteredProgressFunnel].sort((a, b) => a.chapterOrder - b.chapterOrder).map((step, i) => {
                    const pct = step.totalStudents > 0 ? Math.round((step.studentsReached / step.totalStudents) * 100) : 0
                    return (
                      <div key={step.chapterTitle}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-text-secondary truncate flex-1">{step.chapterTitle}</span>
                          <span className="text-[10px] font-semibold text-text-primary tabular-nums shrink-0 ml-1">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 40 ? "bg-cerrado-600" : pct >= 20 ? "bg-cerrado-600/50" : "bg-cerrado-600/25"}`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ TAB: APRENDIZAGEM ═══════════════════ */}
      {activeTab === "aprendizagem" && (
        <div className="space-y-6">
          <DepthDistributionChart data={currentData.depthDistribution} />

          <ReflectionAnalytics
            modules={moduleStats}
            totalReflections={totalReflections}
            totalStudents={totalStudents}
          />

          {currentData.alerts.length > 0 && <AlertAttentionList alerts={currentData.alerts} />}

          {currentData.kolbTeam.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <KolbTeamScatter data={currentData.kolbTeam} />
              <DivergenceComparisonTable data={currentData.divergenceTable} />
            </div>
          )}

          {(currentData.cognitivePatterns.length > 0 || currentData.emotionalJourney.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {currentData.cognitivePatterns.length > 0 && <CognitivePatternsChart data={currentData.cognitivePatterns} />}
              {currentData.emotionalJourney.length > 0 && <EmotionalJourneyChart data={currentData.emotionalJourney} />}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: ALUNOS ═══════════════════ */}
      {activeTab === "alunos" && (
        <div className="space-y-6">
          {isSearching && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cerrado-600/5 border border-cerrado-600/10">
              <Search size={12} className="text-cerrado-600" />
              <span className="text-xs text-cerrado-600 font-medium">
                Filtrando por "{studentSearch}" — {filteredRoster.length} aluno(s)
              </span>
            </div>
          )}

          <StudentRoster students={isSearching ? filteredRoster : rosterStudents} totalChapters={totalChapters} avgSessions={avgSessions} avgReflections={avgReflections} />
        </div>
      )}
    </div>
  )
}
