"use client"

import { Select } from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Activity, BookOpen, GraduationCap, Search, Sparkles, Users } from "lucide-react"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import type { AggregateAnalyticsResponse } from "@/types/analytics"
import { AlertAttentionList } from "./alert-attention-list"
import { CognitivePatternsChart } from "./cognitive-patterns-chart"
import { DepthDistributionChart } from "./depth-distribution-chart"
import { DivergenceComparisonTable } from "./divergence-comparison-table"
import { EmotionalJourneyChart } from "./emotional-journey-chart"
import { KolbTeamScatter } from "./kolb-team-scatter"
import { SummaryCardsRow } from "./summary-cards-row"
import { AiInsightsBox, generateUsageInsights, generateLearningInsights } from "./ai-insights-box"
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

export interface DepthByWeek { week: string; avgDepth: number; sessions: number }
export interface WordsPerModule { chapterTitle: string; chapterOrder: number; avgWords: number; reflectionCount: number }
export interface UnitDepthComparison { areaName: string; avgDepth: number; sessionsAnalyzed: number; reflectionCount: number; studentCount: number }
export interface StudentModuleHeatmapRow { studentName: string; modules: Array<{ chapterTitle: string; status: "completed" | "started" | "none" }> }

export interface ConsciousnessStats {
  totalPre: number
  totalPost: number
  avgPreRating: number
  avgPostRating: number
  avgDelta: number | null
  completionRate: number
  avgChallengeLength: number
  uniqueStudents: number
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
  depthByWeek?: DepthByWeek[]
  wordsPerModule?: WordsPerModule[]
  unitDepthComparison?: UnitDepthComparison[]
  studentModuleHeatmap?: StudentModuleHeatmapRow[]
  moduleNames?: string[]
  consciousnessStats?: ConsciousnessStats
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
  depthByWeek = [],
  wordsPerModule = [],
  unitDepthComparison = [],
  studentModuleHeatmap = [],
  moduleNames = [],
  consciousnessStats,
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
    initialData: undefined, // Always fetch from API to get temporal deltas
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
      {/* Row 1: Tabs */}
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
        <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>

      {/* Row 2: Context filters (course + search) */}
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {isFetching && <p className="text-center text-sm text-text-muted">Carregando dados...</p>}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">Falha ao carregar dados.</div>
      )}

      {/* ═══════════════════ TAB: USO DA PLATAFORMA ═══════════════════ */}
      {activeTab === "uso" && (
        <div className="space-y-6">
          <SummaryCardsRow summary={currentData.summary} />

          <AiInsightsBox
            title="Insights de Uso"
            insights={generateUsageInsights({
              totalSessions: currentData.summary.totalSessions,
              deltaSessions: currentData.summary.deltaSessions,
              engagementRate: currentData.summary.engagementRate,
              rosterStudents,
              unitStats,
            })}
            aiTab="uso"
            aiMetrics={{
              totalSessions: currentData.summary.totalSessions,
              deltaSessions: currentData.summary.deltaSessions,
              engagementRate: currentData.summary.engagementRate,
              totalStudents: rosterStudents.length,
              neverAccessed: rosterStudents.filter((s) => s.risk === "never_accessed").length,
              inactive: rosterStudents.filter((s) => s.risk === "inactive").length,
              units: unitStats.map((u) => ({
                name: u.areaName,
                activePct: u.totalStudents > 0 ? Math.round((u.activeStudents / u.totalStudents) * 100) : 0,
                completionPct: u.completionPct,
              })),
            }}
          />

          {unitStats.length >= 2 && <UnitComparison units={unitStats} />}

          {/* Sessions per week trend */}
          {sessionsByWeek.length > 0 && (() => {
            const maxWeek = Math.max(...sessionsByWeek.map((s) => s.count), 1)
            const totalWeekSessions = sessionsByWeek.reduce((s, w) => s + w.count, 0)
            return (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
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
                          className={`w-full rounded-t-lg transition-all ${isLast ? "bg-cerrado-600" : w.count > 0 ? "bg-cerrado-600/50" : "bg-black/[0.04] dark:bg-white/[0.04]"}`}
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
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Módulos Mais Acessados</h3>
                <div className="space-y-3">
                  {[...filteredModuleAccess].sort((a, b) => b.sessionCount - a.sessionCount).map((mod, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-text-primary truncate">{mod.chapterTitle}</span>
                        <span className="text-[10px] font-semibold text-text-primary tabular-nums shrink-0 ml-2">{mod.sessionCount}</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
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
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
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
                        <div className="h-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
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
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
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
                        <div className="h-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
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
          {/* Consciousness Analytics (Tranjan — Roda do Aprendizado) */}
          {consciousnessStats && consciousnessStats.totalPre > 0 && (
            <div className="rounded-xl border border-border-subtle bg-bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-text-primary">Fase Consciência — Roda do Aprendizado</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Alunos que responderam</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{consciousnessStats.uniqueStudents}</p>
                  <p className="text-xs text-text-muted">{consciousnessStats.totalPre} respostas pré-curso</p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Autoavaliação média (pré)</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{consciousnessStats.avgPreRating}<span className="text-sm text-text-muted">/5</span></p>
                  <p className="text-xs text-text-muted">Nível de partida dos alunos</p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Evolução média</p>
                  <p className={`mt-1 text-2xl font-bold ${consciousnessStats.avgDelta !== null && consciousnessStats.avgDelta > 0 ? "text-emerald-600" : "text-text-primary"}`}>
                    {consciousnessStats.avgDelta !== null ? `${consciousnessStats.avgDelta > 0 ? "+" : ""}${consciousnessStats.avgDelta}` : "—"}
                  </p>
                  <p className="text-xs text-text-muted">{consciousnessStats.totalPost} encerramentos realizados</p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Taxa de conclusão consciente</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{consciousnessStats.completionRate}%</p>
                  <p className="text-xs text-text-muted">Pré → Pós (ritual completo)</p>
                </div>
              </div>
            </div>
          )}

          <AiInsightsBox
            title="Insights de Aprendizagem"
            insights={generateLearningInsights({
              avgDepth: currentData.summary.avgDepth,
              totalReflections,
              totalStudents,
              moduleStats,
            })}
            aiTab="aprendizagem"
            aiMetrics={{
              avgDepth: currentData.summary.avgDepth,
              totalReflections,
              totalStudents,
              zeroReflModules: moduleStats.filter((m) => m.reflectionCount === 0).length,
              topModule: moduleStats.length > 0 ? [...moduleStats].sort((a, b) => b.reflectionCount - a.reflectionCount)[0]?.chapterTitle : null,
              topModuleCount: moduleStats.length > 0 ? [...moduleStats].sort((a, b) => b.reflectionCount - a.reflectionCount)[0]?.reflectionCount : 0,
              avgWords: moduleStats.filter((m) => m.avgWordCount > 0).length > 0 ? Math.round(moduleStats.filter((m) => m.avgWordCount > 0).reduce((s, m) => s + m.avgWordCount, 0) / moduleStats.filter((m) => m.avgWordCount > 0).length) : 0,
            }}
          />

          {/* Depth distribution + Depth trend (side by side) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DepthDistributionChart data={currentData.depthDistribution} />

            {/* Depth evolution by week */}
            {depthByWeek.length > 0 && (() => {
              const maxDepth = 7
              const hasData = depthByWeek.some((w) => w.avgDepth > 0)
              return (
                <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary">Evolução da Profundidade</h3>
                  <p className="text-[9px] text-text-muted">Profundidade média por semana (escala 1-7)</p>
                  {hasData ? (
                    <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                      {depthByWeek.map((w, i) => {
                        const h = (w.avgDepth / maxDepth) * 100
                        const isLast = i === depthByWeek.length - 1
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                            {w.avgDepth > 0 && <span className="text-[8px] font-bold text-text-primary tabular-nums">{w.avgDepth}</span>}
                            <div
                              className={`w-full rounded-t-md transition-all ${isLast ? "bg-[#8b5cf6]" : w.avgDepth > 0 ? "bg-[#8b5cf6]/40" : "bg-black/[0.04] dark:bg-white/[0.04]"}`}
                              style={{ height: `${Math.max(h, w.avgDepth > 0 ? 10 : 4)}%` }}
                            />
                            <span className="text-[7px] text-text-muted">{w.week}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted py-8 text-center">Sem dados de profundidade no período.</p>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Words per module + Unit depth comparison */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Words per module */}
            {wordsPerModule.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">Profundidade das Reflexões por Módulo</h3>
                <p className="text-[9px] text-text-muted">Média de palavras por reflexão — módulos que geram respostas mais elaboradas</p>
                <div className="space-y-2.5">
                  {wordsPerModule.filter((m) => m.reflectionCount > 0).map((m) => {
                    const maxWords = Math.max(...wordsPerModule.map((w) => w.avgWords), 1)
                    const barW = (m.avgWords / maxWords) * 100
                    return (
                      <div key={m.chapterTitle}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-text-primary font-medium truncate flex-1">{m.chapterTitle}</span>
                          <span className="text-[10px] font-semibold text-text-primary tabular-nums shrink-0 ml-2">~{m.avgWords} palavras</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-varzea" style={{ width: `${barW}%` }} />
                        </div>
                        <span className="text-[8px] text-text-muted">{m.reflectionCount} reflexões</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unit depth comparison */}
            {unitDepthComparison.length >= 2 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Aprendizagem por Unidade</h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${unitDepthComparison.length}, 1fr)` }}>
                  {unitDepthComparison.map((u) => {
                    const best = unitDepthComparison.reduce((a, b) => a.avgDepth > b.avgDepth ? a : b)
                    const isBest = u.areaName === best.areaName && u.avgDepth > 0
                    return (
                      <div key={u.areaName} className={`rounded-xl p-4 space-y-3 ${isBest ? "bg-[#8b5cf6]/5 border border-[#8b5cf6]/15" : "bg-gray-50 dark:bg-white/[0.04]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-text-primary">{u.areaName}</p>
                          <span className="text-[9px] text-text-muted">{u.studentCount} alunos</span>
                        </div>
                        <div className="text-center py-1">
                          <p className={`text-3xl font-bold tabular-nums ${u.avgDepth > 0 ? "text-[#8b5cf6]" : "text-text-muted"}`}>{u.avgDepth}<span className="text-sm text-text-muted font-normal">/7</span></p>
                          <p className="text-[9px] text-text-muted uppercase mt-0.5">Profundidade média</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.04]">
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">{u.sessionsAnalyzed}</p>
                            <p className="text-[8px] text-text-muted">Sessões</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">{(u as any).completedSessions ?? 0}</p>
                            <p className="text-[8px] text-text-muted">Concluídas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">{u.reflectionCount}</p>
                            <p className="text-[8px] text-text-muted">Reflexões</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reflections by module */}
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
      {activeTab === "alunos" && (() => {
        const active7d = rosterStudents.filter((s) => s.daysSinceLastActivity !== null && s.daysSinceLastActivity <= 7).length
        const active30d = rosterStudents.filter((s) => s.daysSinceLastActivity !== null && s.daysSinceLastActivity <= 30).length
        const neverCount = rosterStudents.filter((s) => s.risk === "never_accessed").length
        const sortedByEngagement = [...rosterStudents].sort((a, b) => (b.completedSessions * 2 + b.reflectionsCount) - (a.completedSessions * 2 + a.reflectionsCount))
        const top5 = sortedByEngagement.filter((s) => s.totalSessions > 0).slice(0, 5)
        const bottom5 = sortedByEngagement.filter((s) => s.totalSessions > 0).slice(-5).reverse()

        // Area breakdown
        const areaMap = new Map<string, { total: number; active: number }>()
        for (const s of rosterStudents) {
          const area = s.areaName ?? "Sem área"
          const entry = areaMap.get(area) ?? { total: 0, active: 0 }
          entry.total++
          if (s.daysSinceLastActivity !== null && s.daysSinceLastActivity <= 30) entry.active++
          areaMap.set(area, entry)
        }

        return (
          <div className="space-y-6">
            {isSearching && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cerrado-600/5 border border-cerrado-600/10">
                <Search size={12} className="text-cerrado-600" />
                <span className="text-xs text-cerrado-600 font-medium">
                  Filtrando por "{studentSearch}" — {filteredRoster.length} aluno(s)
                </span>
              </div>
            )}

            {/* Summary cards */}
            {!isSearching && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: rosterStudents.length, label: "Total de Alunos", color: "text-text-primary" },
                  { value: active7d, label: "Ativos (7 dias)", color: "text-semantic-success" },
                  { value: active30d, label: "Ativos (30 dias)", color: "text-cerrado-600" },
                  { value: neverCount, label: "Nunca acessaram", color: "text-semantic-error" },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl bg-white dark:bg-bg-card p-4 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] text-center">
                    <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Top vs Bottom engagement */}
            {!isSearching && top5.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Top 5 */}
                <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                    <span className="text-semantic-success">▲</span> Mais Engajados
                  </h3>
                  <div className="space-y-2">
                    {top5.map((s, i) => {
                      const score = s.completedSessions * 2 + s.reflectionsCount
                      return (
                        <div key={s.id} className="flex items-center gap-2.5">
                          <span className="text-[10px] text-text-muted w-4 text-right tabular-nums font-semibold">{i + 1}</span>
                          <span className="text-xs font-medium text-text-primary flex-1 truncate">{s.name}</span>
                          <span className="text-[10px] text-text-muted">{s.completedSessions}s · {s.reflectionsCount}r</span>
                          <span className="text-xs font-bold text-semantic-success tabular-nums w-8 text-right">{score}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom 5 */}
                <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                    <span className="text-semantic-error">▼</span> Menos Engajados
                  </h3>
                  <div className="space-y-2">
                    {bottom5.map((s) => {
                      const score = s.completedSessions * 2 + s.reflectionsCount
                      return (
                        <div key={s.id} className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${s.risk === "inactive" ? "bg-semantic-error" : s.risk === "at_risk" ? "bg-yellow-500" : "bg-gray-300"}`} />
                          <span className="text-xs font-medium text-text-primary flex-1 truncate">{s.name}</span>
                          <span className="text-[10px] text-text-muted">
                            {s.daysSinceLastActivity !== null ? `há ${s.daysSinceLastActivity}d` : "—"}
                          </span>
                          <span className="text-xs font-bold text-semantic-error tabular-nums w-8 text-right">{score}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Area breakdown */}
            {!isSearching && areaMap.size > 1 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Alunos por Unidade</h3>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(areaMap.size, 4)}, 1fr)` }}>
                  {[...areaMap.entries()].map(([area, data]) => {
                    const activePct = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0
                    return (
                      <div key={area} className="text-center">
                        <p className="text-xl font-bold text-text-primary tabular-nums">{data.total}</p>
                        <p className="text-[10px] text-text-muted font-medium">{area}</p>
                        <p className="text-[9px] text-semantic-success font-semibold mt-0.5">{activePct}% ativos</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Heatmap aluno × módulo */}
            {!isSearching && studentModuleHeatmap.length > 0 && moduleNames.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-3 overflow-x-auto">
                <h3 className="text-sm font-semibold text-text-primary">Mapa de Progresso — Aluno × Módulo</h3>
                <div className="min-w-[600px]">
                  {/* Header row */}
                  <div className="flex items-end gap-0.5 mb-1 ml-[140px]">
                    {moduleNames.map((name) => (
                      <div key={name} className="flex-1 min-w-[40px]">
                        <span className="text-[7px] text-text-muted leading-tight block truncate" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", height: 60 }}>
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Student rows */}
                  <div className="space-y-0.5">
                    {studentModuleHeatmap.map((row, idx) => (
                      <div key={`${row.studentName}-${idx}`} className="flex items-center gap-0.5">
                        <span className="text-[9px] text-text-secondary w-[140px] shrink-0 truncate pr-2">{row.studentName}</span>
                        {row.modules.map((m, i) => (
                          <div
                            key={i}
                            className={`flex-1 min-w-[40px] h-5 rounded-sm ${
                              m.status === "completed" ? "bg-semantic-success" :
                              m.status === "started" ? "bg-yellow-400" :
                              "bg-gray-100 dark:bg-bg-elevated"
                            }`}
                            title={`${row.studentName} — ${m.chapterTitle}: ${m.status === "completed" ? "Concluído" : m.status === "started" ? "Iniciado" : "Não iniciado"}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 ml-[140px]">
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-semantic-success" /><span className="text-[9px] text-text-muted">Concluído</span></div>
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-yellow-400" /><span className="text-[9px] text-text-muted">Iniciado</span></div>
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-gray-100" /><span className="text-[9px] text-text-muted">Não iniciado</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Student roster */}
            <StudentRoster students={isSearching ? filteredRoster : rosterStudents} totalChapters={totalChapters} avgSessions={avgSessions} avgReflections={avgReflections} />
          </div>
        )
      })()}
    </div>
  )
}
