"use client"

import { PeriodFilter } from "@/components/dashboard/period-filter"
import type {
  AggregateAnalyticsResponse,
  AnalyticsRole,
  AreaStats,
  ComparisonMode,
  ComparisonResponse,
} from "@/types/analytics"
import { COMPARISON_MODES_BY_ROLE as MODES_BY_ROLE } from "@/types/analytics"
import { useQuery } from "@tanstack/react-query"
import { Activity, BookOpen, Building2, ChevronDown, Search, Sparkles, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AiInsightsBox, generateLearningInsights, generateUsageInsights } from "./ai-insights-box"
import { AlertAttentionList } from "./alert-attention-list"
import { CognitivePatternsChart } from "./cognitive-patterns-chart"
import { DepthDistributionChart } from "./depth-distribution-chart"
import { DivergenceComparisonTable } from "./divergence-comparison-table"
import { EmotionalJourneyChart } from "./emotional-journey-chart"
import { KolbTeamScatter } from "./kolb-team-scatter"
import { ModuleEngagementChart } from "./module-engagement-chart"
import { ModuleFunnelCombined } from "./module-funnel-combined"
import { NextBestAction } from "./next-best-action"
import { type ModuleReflectionStats, ReflectionAnalytics } from "./reflection-analytics"
import { WeeklySessionsChart } from "./session-journey-chart"
import { StudentRoster, type StudentRosterEntry } from "./student-roster"
import { LearningIndicatorsCard } from "./summary-cards-row"
import { SummaryOverview } from "./summary-overview"
import { UnitComparison, type UnitStats } from "./unit-comparison"

export interface SessionsByWeek {
  week: string
  count: number
}

export interface ModuleAccess {
  chapterTitle: string
  chapterOrder: number
  courseId: string
  /** Chapter UUID — stable join key for the engagement indicators (indMap). */
  chapterId: string
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

export interface DepthByWeek {
  week: string
  avgDepth: number
  sessions: number
}
export interface WordsPerModule {
  chapterTitle: string
  chapterOrder: number
  avgWords: number
  reflectionCount: number
}
export interface UnitDepthComparison {
  areaName: string
  avgDepth: number
  sessionsAnalyzed: number
  reflectionCount: number
  studentCount: number
}
export interface StudentModuleHeatmapRow {
  studentName: string
  modules: Array<{ chapterTitle: string; status: "completed" | "started" | "none" }>
}

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
  /**
   * Server-side area scope, set by analytics/page.tsx (getAreaStudentIds).
   * `isAreaScoped` true means every server prop already describes the active
   * unit, so the client must NOT re-filter by area (that double-filter dropped
   * students who belong to multiple areas). `scopedAreaName` drives the banner.
   */
  isAreaScoped?: boolean
  scopedAreaName?: string
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
  /**
   * 1.2 — The DB role of the currently logged-in user, mapped to AnalyticsRole.
   * Controls which comparison modes the UI renders. Defaults to "manager" (the
   * most common non-admin role) if not supplied, which shows the minimal safe set.
   */
  userRole?: AnalyticsRole
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
  isAreaScoped = false,
  scopedAreaName,
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
  userRole = "manager",
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uso")
  const [period, setPeriod] = useState("30d")
  const [courseId, setCourseId] = useState("")
  const [areaId, setAreaId] = useState(initialAreaId ?? "")
  const [interactionType, setInteractionType] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  // Reage ao seletor global de "Unidade" do header: switchArea grava um cookie e
  // revalida o layout, re-renderizando esta page (server) com um novo initialAreaId.
  // Sem este efeito, o state ficaria preso ao valor do mount e os dados de baixo
  // (indicadores, comparação, gráficos por escopo) não mudariam ao trocar a unidade.
  // Também limpa a busca de aluno: o roster é trocado pela população da nova
  // unidade — uma query remanescente filtraria silenciosamente outro conjunto,
  // parecendo que o dashboard não reagiu à troca. (setAreaId é o único caller de
  // areaId, então areaId muda ⟺ initialAreaId muda.)
  useEffect(() => {
    setAreaId(initialAreaId ?? "")
    setStudentSearch("")
  }, [initialAreaId])
  // Item 8 — corporate unit selector state. null = all units (default fan-out).
  // SCOPE BOUNDARY: corporateUnitFilter only narrows the client-side comparison
  // fetch (/api/analytics/manager-groups). It does NOT re-scope the SSR props
  // (unitStats/unitDepthComparison) — those follow the header Unidade cookie
  // (initialAreaId) only. A corporate gestor narrowing here won't reshape the
  // Aprendizagem SSR cards; use the header Unidade selector for full scoping.
  // TODO(follow-up): unify corporate narrowing with server scope if needed.
  const [corporateUnitFilter, setCorporateUnitFilter] = useState<string | null>(null)

  // Modes allowed for this role (1.2 — fixed rules, no config screen)
  const allowedModes = MODES_BY_ROLE[userRole] as readonly ComparisonMode[]

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

  // Item 1.2 — fetch comparison data (areas + managers) for UnitComparison modes
  // Item 8 — pass unitFilter when corporate selector is active
  const { data: comparisonData } = useQuery<ComparisonResponse>({
    queryKey: ["analytics-comparison", period, areaId, courseId, corporateUnitFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ view: "comparison", period })
      if (areaId) params.set("areaId", areaId)
      if (courseId) params.set("courseId", courseId)
      if (corporateUnitFilter) params.set("unitFilter", corporateUnitFilter)
      const r = await fetch(`/api/analytics/manager-groups?${params.toString()}`)
      if (!r.ok) throw new Error(`Comparison fetch failed: ${r.status}`)
      return r.json()
    },
  })

  // Item 1.2 (TASK 1) — courseStats now come from the SAME comparison fetch
  // (ComparisonResponse.courses) — session-based math, tenant-wide, symmetric
  // with units/areas. The old manager-courses fetch (role-gated, enrollment-based)
  // is no longer the source for the comparison view.
  const courseStats = comparisonData?.courses ?? []

  const areaStats = comparisonData?.areas ?? []

  // Item 8 — detect whether the current user (as a gestor) has a corporate group.
  // A corporate group spans >1 UNIDADE and its AreaStats.isCorporate=true.
  // When detected, render the unit selector so the gestor can narrow to one UNIDADE.
  const corporateAreas = useMemo<AreaStats[]>(
    () => (comparisonData?.areas ?? []).filter((a) => a.isCorporate),
    [comparisonData],
  )
  // The spanned UNIDADEs come from the corporate area's `units` array.
  // We union across all corporate areas in case a gestor owns more than one.
  const corporateSpannedUnits = useMemo<Array<{ id: string; name: string }>>(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; name: string }> = []
    for (const a of corporateAreas) {
      for (const u of a.units) {
        if (!seen.has(u.id)) {
          seen.add(u.id)
          result.push(u)
        }
      }
    }
    return result
  }, [corporateAreas])
  const hasCorporateGroup = corporateAreas.length > 0

  const currentData = data ?? initialData
  const isFetching = isLoading && !data

  const searchLower = studentSearch.toLowerCase()
  const isSearching = searchLower.length > 1

  // Resolve area name from areaId for client-side filtering. Falls back to the
  // server-authoritative scopedAreaName so the label stays correct even if the
  // `areas` prop lags behind `initialAreaId` during a revalidation frame.
  const selectedAreaName = useMemo(() => {
    if (!areaId) return ""
    return areas.find((a) => a.id === areaId)?.name ?? scopedAreaName ?? ""
  }, [areaId, areas, scopedAreaName])

  // Area-filtered roster (before search).
  // When the server already scoped to a unit (isAreaScoped), the roster IS the
  // unit's roster — re-filtering by area name here would wrongly drop students
  // who belong to more than one area. We only fall back to name-filtering when
  // the server is NOT scoped (legacy/no-cookie path).
  const areaFilteredRoster = useMemo(() => {
    if (isAreaScoped) return rosterStudents
    if (!selectedAreaName) return rosterStudents
    return rosterStudents.filter((s) => s.areaName === selectedAreaName)
  }, [rosterStudents, selectedAreaName, isAreaScoped])

  // Area-filtered student names (for module stats filtering). Null = no client
  // filter; when server-scoped, moduleStats reflections are already narrowed.
  const areaStudentNames = useMemo(() => {
    if (isAreaScoped) return null
    if (!selectedAreaName) return null
    return new Set(areaFilteredRoster.map((s) => s.name))
  }, [areaFilteredRoster, selectedAreaName, isAreaScoped])

  const filteredRoster = useMemo(() => {
    const base = areaFilteredRoster
    if (!isSearching) return base
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(searchLower) || s.email.toLowerCase().includes(searchLower),
    )
  }, [areaFilteredRoster, searchLower, isSearching])

  const filteredModuleStats = useMemo(() => {
    let base = moduleStats
    // Filter by area first
    if (areaStudentNames) {
      base = base.map((mod) => {
        const areaReflections = (mod.reflections ?? []).filter((r) =>
          areaStudentNames.has(r.studentName),
        )
        return {
          ...mod,
          reflections: areaReflections,
          reflectionCount: areaReflections.length,
          studentCount: new Set(areaReflections.map((r) => r.studentName)).size,
        }
      })
    }
    // Then filter by search
    if (!isSearching) return base
    return base.map((mod) => ({
      ...mod,
      reflections: (mod.reflections ?? []).filter((r) =>
        r.studentName.toLowerCase().includes(searchLower),
      ),
      reflectionCount: (mod.reflections ?? []).filter((r) =>
        r.studentName.toLowerCase().includes(searchLower),
      ).length,
    }))
  }, [moduleStats, areaStudentNames, searchLower, isSearching])

  const filteredTotalReflections =
    isSearching || areaStudentNames
      ? filteredModuleStats.reduce((sum, m) => sum + m.reflectionCount, 0)
      : totalReflections

  // Class averages for comparison (use area-filtered if area selected)
  const avgBase = areaFilteredRoster
  const avgSessions =
    avgBase.length > 0
      ? avgBase.reduce((sum, s) => sum + s.completedSessions, 0) / avgBase.length
      : 0
  const avgReflections =
    avgBase.length > 0
      ? avgBase.reduce((sum, s) => sum + s.reflectionsCount, 0) / avgBase.length
      : 0

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
    // Can't filter by chapterId without mapping, so return all modes when course filtered
    return interactionModes
  }, [interactionModes, courseId])

  const totalInteractions = filteredInteractionModes.reduce((sum, m) => sum + m.count, 0)

  // Whether UnitComparison should be shown (any mode has ≥ 2 items)
  const showUnitComparison =
    unitStats.length >= 2 || areaStats.length >= 2 || courseStats.length >= 2

  return (
    <div className="space-y-6">
      {/* Row 1: Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-bg-card p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
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

      {/* Scope banner — makes the active unit explicit so the numbers below are
          never mistaken for tenant-wide totals. Shown only when a unit is active. */}
      {isAreaScoped && scopedAreaName && (
        <div className="flex items-center gap-2 rounded-xl bg-cerrado-50 dark:bg-cerrado-600/10 border border-cerrado-200/60 dark:border-cerrado-600/20 px-4 py-2.5">
          <Building2 size={15} className="text-cerrado-600 shrink-0" />
          <span className="text-xs text-text-secondary">
            Exibindo dados apenas da unidade{" "}
            <strong className="font-semibold text-text-primary">{scopedAreaName}</strong>. Use o
            seletor <span className="font-medium">Unidade</span> no topo para alternar ou ver todas.
          </span>
        </div>
      )}

      {/* Row 2: Context filters (course + area + search) */}
      <div className="flex flex-wrap items-center gap-3">
        {activeTab === "alunos" && (
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-52 rounded-xl bg-white dark:bg-bg-card pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] focus:outline-none focus:shadow-[0_2px_12px_rgba(224,122,47,0.15),0_0_0_2px_rgba(224,122,47,0.3)] transition-shadow"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setStudentSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cerrado-600 font-medium"
              >
                Limpar
              </button>
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
        {/* Area filter removed — global AreaSelector in header handles this */}
      </div>

      {isFetching && <p className="text-center text-sm text-text-muted">Carregando dados...</p>}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          Falha ao carregar dados.
        </div>
      )}

      {/* ═══════════════════ TAB: USO DA PLATAFORMA ═══════════════════ */}
      {activeTab === "uso" && (
        <div className="space-y-6">
          <SummaryOverview
            unitStats={unitStats}
            selectedAreaName={scopedAreaName || selectedAreaName || undefined}
          />

          {/* Item 2.4 — LearningIndicatorsCard (Uso tab: base cards only, no depth/breakthroughs) */}
          <LearningIndicatorsCard
            summary={currentData.summary}
            scope="unit"
            indicators={currentData.indicators}
            showDepthAndBreakthroughs={false}
          />

          {/* Insights + Ações — bloco unificado */}
          <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-0">
            <AiInsightsBox
              embedded
              title="Insights de Uso"
              insights={generateUsageInsights({
                totalSessions: currentData.summary.totalSessions,
                deltaSessions: currentData.summary.deltaSessions,
                engagementRate: currentData.summary.engagementRate,
                rosterStudents: areaFilteredRoster,
                unitStats,
              })}
              aiTab="uso"
              aiMetrics={{
                totalSessions: currentData.summary.totalSessions,
                deltaSessions: currentData.summary.deltaSessions,
                engagementRate: currentData.summary.engagementRate,
                totalStudents: areaFilteredRoster.length,
                neverAccessed: areaFilteredRoster.filter((s) => s.risk === "never_accessed").length,
                inactive: areaFilteredRoster.filter((s) => s.risk === "inactive").length,
                units: unitStats.map((u) => ({
                  name: u.areaName,
                  activePct:
                    u.totalStudents > 0
                      ? Math.round((u.activeStudents / u.totalStudents) * 100)
                      : 0,
                  completionPct: u.completionPct,
                })),
              }}
            />
            <NextBestAction
              rosterStudents={areaFilteredRoster}
              unitStats={unitStats}
              perModule={currentData.indicators?.perModule}
              courseId={courseId || undefined}
              areaId={areaId || undefined}
            />
          </div>

          {/* Item 8 — Corporate unit selector (only for gestores with corporate groups) */}
          {hasCorporateGroup && corporateSpannedUnits.length >= 2 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-bg-card shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border dark:border-white/[0.06]">
              <Building2 size={14} className="text-cerrado-600 shrink-0" />
              <span className="text-[11px] font-semibold text-text-primary shrink-0">
                Visão corporativa:
              </span>
              <div className="relative inline-flex items-center">
                <select
                  value={corporateUnitFilter ?? "all"}
                  onChange={(e) =>
                    setCorporateUnitFilter(e.target.value === "all" ? null : e.target.value)
                  }
                  className="appearance-none text-[11px] font-medium text-text-primary bg-transparent rounded-md pl-2 pr-6 py-1 cursor-pointer hover:text-cerrado-600 transition-colors focus:outline-none"
                >
                  <option value="all">Todas as unidades do grupo</option>
                  {corporateSpannedUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* Item 1.2 + 7 — UnitComparison with role-gated modes (units/areas/courses) */}
          {showUnitComparison && (
            <UnitComparison
              units={unitStats}
              areaStats={areaStats}
              courseStats={courseStats}
              allowedModes={allowedModes}
            />
          )}

          {/* Item 3 — WeeklySessionsChart (replaces inline bar block) */}
          {sessionsByWeek.length > 0 && <WeeklySessionsChart data={sessionsByWeek} />}

          {/* Item 4 — ModuleFunnelCombined (replaces "Módulos Mais Acessados" + "Funil de Progresso") */}
          {(filteredModuleAccess.length > 0 || filteredProgressFunnel.length > 0) && (
            <ModuleFunnelCombined
              moduleAccess={filteredModuleAccess}
              progressFunnel={filteredProgressFunnel}
            />
          )}

          {/* Interaction modes — standalone card (was in the 3-column grid with the two removed cards) */}
          {filteredInteractionModes.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Modos de Interação</h3>
              <div className="space-y-3">
                {filteredInteractionModes.map((mode) => {
                  const pct =
                    totalInteractions > 0 ? Math.round((mode.count / totalInteractions) * 100) : 0
                  const colors: Record<string, string> = {
                    socratic_dialogue: "bg-cerrado-600",
                    quiz: "bg-varzea",
                    scenario: "bg-yellow-500",
                    assignment: "bg-[#8b5cf6]",
                  }
                  return (
                    <div key={mode.mode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${colors[mode.mode] ?? "bg-neutral-400"}`}
                          />
                          <span className="text-[11px] font-medium text-text-primary">
                            {mode.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-text-primary tabular-nums">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors[mode.mode] ?? "bg-neutral-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-text-muted">{mode.count} sessões</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Item 5 — ModuleEngagementChart (sessions + engagement per module) */}
          {filteredModuleAccess.length > 0 && (
            <ModuleEngagementChart
              moduleAccess={filteredModuleAccess}
              indicators={currentData.indicators?.perModule}
            />
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: APRENDIZAGEM ═══════════════════ */}
      {activeTab === "aprendizagem" && (
        <div className="space-y-6">
          {/* Consciousness Analytics (Tranjan — Roda do Aprendizado) */}
          {consciousnessStats && consciousnessStats.totalPre > 0 && (
            <div className="rounded-xl bg-bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Fase Consciência — Roda do Aprendizado
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Alunos que responderam</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {consciousnessStats.uniqueStudents}
                  </p>
                  <p className="text-xs text-text-muted">
                    {consciousnessStats.totalPre} respostas pré-curso
                  </p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Autoavaliação média (pré)</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {consciousnessStats.avgPreRating}
                    <span className="text-sm text-text-muted">/5</span>
                  </p>
                  <p className="text-xs text-text-muted">Nível de partida dos alunos</p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">Evolução média</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${consciousnessStats.avgDelta !== null && consciousnessStats.avgDelta > 0 ? "text-emerald-600" : "text-text-primary"}`}
                  >
                    {consciousnessStats.avgDelta !== null
                      ? `${consciousnessStats.avgDelta > 0 ? "+" : ""}${consciousnessStats.avgDelta}`
                      : "—"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {consciousnessStats.totalPost} encerramentos realizados
                  </p>
                </div>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <p className="text-xs font-medium text-text-muted">
                    Taxa de conclusão consciente
                  </p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {consciousnessStats.completionRate}%
                  </p>
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
              topModule:
                moduleStats.length > 0
                  ? [...moduleStats].sort((a, b) => b.reflectionCount - a.reflectionCount)[0]
                      ?.chapterTitle
                  : null,
              topModuleCount:
                moduleStats.length > 0
                  ? [...moduleStats].sort((a, b) => b.reflectionCount - a.reflectionCount)[0]
                      ?.reflectionCount
                  : 0,
              avgWords:
                moduleStats.filter((m) => m.avgWordCount > 0).length > 0
                  ? Math.round(
                      moduleStats
                        .filter((m) => m.avgWordCount > 0)
                        .reduce((s, m) => s + m.avgWordCount, 0) /
                        moduleStats.filter((m) => m.avgWordCount > 0).length,
                    )
                  : 0,
            }}
          />

          {/* Item 2.1 + 2.4 — LearningIndicatorsCard with depth & breakthroughs in Aprendizagem tab */}
          <LearningIndicatorsCard
            summary={currentData.summary}
            scope="unit"
            indicators={currentData.indicators}
            showDepthAndBreakthroughs={true}
          />

          {/* Depth distribution + Depth trend (side by side) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DepthDistributionChart data={currentData.depthDistribution} />

            {/* Depth evolution by week */}
            {depthByWeek.length > 0 &&
              (() => {
                const maxDepth = 7
                const hasData = depthByWeek.some((w) => w.avgDepth > 0)
                return (
                  <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Evolução da Profundidade
                    </h3>
                    <p className="text-[9px] text-text-muted">
                      Profundidade média por semana (escala 1-7)
                    </p>
                    {hasData ? (
                      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                        {depthByWeek.map((w, i) => {
                          const h = (w.avgDepth / maxDepth) * 100
                          const isLast = i === depthByWeek.length - 1
                          return (
                            <div
                              key={w.week}
                              className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end"
                            >
                              {w.avgDepth > 0 && (
                                <span className="text-[8px] font-bold text-text-primary tabular-nums">
                                  {w.avgDepth}
                                </span>
                              )}
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
                      <p className="text-xs text-text-muted py-8 text-center">
                        Sem dados de profundidade no período.
                      </p>
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
                <h3 className="text-sm font-semibold text-text-primary">
                  Profundidade das Reflexões por Módulo
                </h3>
                <p className="text-[9px] text-text-muted">
                  Média de palavras por reflexão — módulos que geram respostas mais elaboradas
                </p>
                <div className="space-y-2.5">
                  {wordsPerModule
                    .filter((m) => m.reflectionCount > 0)
                    .map((m) => {
                      const maxWords = Math.max(...wordsPerModule.map((w) => w.avgWords), 1)
                      const barW = (m.avgWords / maxWords) * 100
                      return (
                        <div key={m.chapterTitle}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-text-primary font-medium truncate flex-1">
                              {m.chapterTitle}
                            </span>
                            <span className="text-[10px] font-semibold text-text-primary tabular-nums shrink-0 ml-2">
                              ~{m.avgWords} palavras
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-varzea"
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-text-muted">
                            {m.reflectionCount} reflexões
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Unit depth comparison */}
            {unitDepthComparison.length >= 2 && (
              <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Aprendizagem por Unidade
                </h3>
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${unitDepthComparison.length}, 1fr)` }}
                >
                  {unitDepthComparison.map((u) => {
                    const best = unitDepthComparison.reduce((a, b) =>
                      a.avgDepth > b.avgDepth ? a : b,
                    )
                    const isBest = u.areaName === best.areaName && u.avgDepth > 0
                    return (
                      <div
                        key={u.areaName}
                        className={`rounded-xl p-4 space-y-3 ${isBest ? "bg-[#8b5cf6]/5 border border-[#8b5cf6]/15" : "bg-gray-50 dark:bg-white/[0.04]"}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-text-primary">{u.areaName}</p>
                          <span className="text-[9px] text-text-muted">
                            {u.studentCount} alunos
                          </span>
                        </div>
                        <div className="text-center py-1">
                          <p
                            className={`text-3xl font-bold tabular-nums ${u.avgDepth > 0 ? "text-[#8b5cf6]" : "text-text-muted"}`}
                          >
                            {u.avgDepth}
                            <span className="text-sm text-text-muted font-normal">/7</span>
                          </p>
                          <p className="text-[9px] text-text-muted uppercase mt-0.5">
                            Profundidade média
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.04]">
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">
                              {u.sessionsAnalyzed}
                            </p>
                            <p className="text-[8px] text-text-muted">Sessões</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">
                              {(u as unknown as { completedSessions?: number }).completedSessions ??
                                0}
                            </p>
                            <p className="text-[8px] text-text-muted">Concluídas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary tabular-nums">
                              {u.reflectionCount}
                            </p>
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
            modules={filteredModuleStats}
            totalReflections={filteredTotalReflections}
            totalStudents={areaStudentNames ? areaStudentNames.size : totalStudents}
          />

          {currentData.alerts.length > 0 && <AlertAttentionList alerts={currentData.alerts} />}

          {currentData.kolbTeam.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <KolbTeamScatter data={currentData.kolbTeam} />
              <DivergenceComparisonTable data={currentData.divergenceTable} />
            </div>
          )}

          {(currentData.cognitivePatterns.length > 0 ||
            currentData.emotionalJourney.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {currentData.cognitivePatterns.length > 0 && (
                <CognitivePatternsChart data={currentData.cognitivePatterns} />
              )}
              {currentData.emotionalJourney.length > 0 && (
                <EmotionalJourneyChart data={currentData.emotionalJourney} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: ALUNOS ═══════════════════ */}
      {activeTab === "alunos" &&
        (() => {
          const baseRoster = selectedAreaName ? areaFilteredRoster : rosterStudents
          const active7d = baseRoster.filter(
            (s) => s.daysSinceLastActivity !== null && s.daysSinceLastActivity <= 7,
          ).length
          const active30d = baseRoster.filter(
            (s) => s.daysSinceLastActivity !== null && s.daysSinceLastActivity <= 30,
          ).length
          const neverCount = baseRoster.filter((s) => s.risk === "never_accessed").length
          const sortedByEngagement = [...baseRoster].sort(
            (a, b) =>
              b.completedSessions * 2 +
              b.reflectionsCount -
              (a.completedSessions * 2 + a.reflectionsCount),
          )
          const top5 = sortedByEngagement.filter((s) => s.totalSessions > 0).slice(0, 5)
          const bottom5 = sortedByEngagement
            .filter((s) => s.totalSessions > 0)
            .slice(-5)
            .reverse()

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
              {(isSearching || selectedAreaName) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cerrado-600/5 border border-cerrado-600/10">
                  <Search size={12} className="text-cerrado-600" />
                  <span className="text-xs text-cerrado-600 font-medium">
                    {selectedAreaName &&
                      !isSearching &&
                      `Unidade: ${selectedAreaName} — ${baseRoster.length} aluno(s)`}
                    {selectedAreaName &&
                      isSearching &&
                      `Unidade: ${selectedAreaName}, busca: "${studentSearch}" — ${filteredRoster.length} aluno(s)`}
                    {!selectedAreaName &&
                      isSearching &&
                      `Filtrando por "${studentSearch}" — ${filteredRoster.length} aluno(s)`}
                  </span>
                </div>
              )}

              {/* Summary cards */}
              {!isSearching && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      value: baseRoster.length,
                      label: "Total de Alunos",
                      color: "text-text-primary",
                    },
                    { value: active7d, label: "Ativos (7 dias)", color: "text-semantic-success" },
                    { value: active30d, label: "Ativos (30 dias)", color: "text-cerrado-600" },
                    { value: neverCount, label: "Nunca acessaram", color: "text-semantic-error" },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-2xl bg-white dark:bg-bg-card p-4 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] text-center"
                    >
                      <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
                        {c.label}
                      </p>
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
                            <span className="text-[10px] text-text-muted w-4 text-right tabular-nums font-semibold">
                              {i + 1}
                            </span>
                            <span className="text-xs font-medium text-text-primary flex-1 truncate">
                              {s.name}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {s.completedSessions}s · {s.reflectionsCount}r
                            </span>
                            <span className="text-xs font-bold text-semantic-success tabular-nums w-8 text-right">
                              {score}
                            </span>
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
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${s.risk === "inactive" ? "bg-semantic-error" : s.risk === "at_risk" ? "bg-yellow-500" : "bg-gray-300"}`}
                            />
                            <span className="text-xs font-medium text-text-primary flex-1 truncate">
                              {s.name}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {s.daysSinceLastActivity !== null
                                ? `há ${s.daysSinceLastActivity}d`
                                : "—"}
                            </span>
                            <span className="text-xs font-bold text-semantic-error tabular-nums w-8 text-right">
                              {score}
                            </span>
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
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    Alunos por Unidade
                  </h3>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(areaMap.size, 4)}, 1fr)` }}
                  >
                    {[...areaMap.entries()].map(([area, areaData]) => {
                      const activePct =
                        areaData.total > 0
                          ? Math.round((areaData.active / areaData.total) * 100)
                          : 0
                      return (
                        <div key={area} className="text-center">
                          <p className="text-xl font-bold text-text-primary tabular-nums">
                            {areaData.total}
                          </p>
                          <p className="text-[10px] text-text-muted font-medium">{area}</p>
                          <p className="text-[9px] text-semantic-success font-semibold mt-0.5">
                            {activePct}% ativos
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Heatmap aluno × módulo */}
              {!isSearching && studentModuleHeatmap.length > 0 && moduleNames.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06] space-y-3 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Mapa de Progresso — Aluno × Módulo
                  </h3>
                  <div className="min-w-[600px]">
                    {/* Header row */}
                    <div className="flex items-end gap-0.5 mb-1 ml-[140px]">
                      {moduleNames.map((name) => (
                        <div key={name} className="flex-1 min-w-[40px]">
                          <span
                            className="text-[7px] text-text-muted leading-tight block truncate"
                            style={{
                              writingMode: "vertical-lr",
                              transform: "rotate(180deg)",
                              height: 60,
                            }}
                          >
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Student rows */}
                    <div className="space-y-0.5">
                      {studentModuleHeatmap.map((row, idx) => (
                        <div
                          key={`${row.studentName}-${idx}`}
                          className="flex items-center gap-0.5"
                        >
                          <span className="text-[9px] text-text-secondary w-[140px] shrink-0 truncate pr-2">
                            {row.studentName}
                          </span>
                          {row.modules.map((m) => (
                            <div
                              key={m.chapterTitle}
                              className={`flex-1 min-w-[40px] h-5 rounded-sm ${
                                m.status === "completed"
                                  ? "bg-semantic-success"
                                  : m.status === "started"
                                    ? "bg-yellow-400"
                                    : "bg-gray-100 dark:bg-bg-elevated"
                              }`}
                              title={`${row.studentName} — ${m.chapterTitle}: ${m.status === "completed" ? "Concluído" : m.status === "started" ? "Iniciado" : "Não iniciado"}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 ml-[140px]">
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-sm bg-semantic-success" />
                        <span className="text-[9px] text-text-muted">Concluído</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-sm bg-yellow-400" />
                        <span className="text-[9px] text-text-muted">Iniciado</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-sm bg-gray-100" />
                        <span className="text-[9px] text-text-muted">Não iniciado</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Student roster */}
              <StudentRoster
                students={isSearching || selectedAreaName ? filteredRoster : baseRoster}
                totalChapters={totalChapters}
                avgSessions={avgSessions}
                avgReflections={avgReflections}
              />
            </div>
          )
        })()}
    </div>
  )
}
