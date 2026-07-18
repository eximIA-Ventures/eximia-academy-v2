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
import { Activity, BookOpen, Building2, ChevronDown, Search, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { generateLearningInsights, generateUsageInsights } from "./ai-insights-box"
import { AlertAttentionList } from "./alert-attention-list"
import {
  Accordion,
  ActionInsightCard,
  GlossaryDrawer,
  HeroStat,
  ScopeBar,
  StatRow,
  ToggleGroup,
} from "./analytics-ui"
import { CognitivePatternsChart } from "./cognitive-patterns-chart"
import { DepthDistributionChart } from "./depth-distribution-chart"
import { DivergenceComparisonTable } from "./divergence-comparison-table"
import { EmotionalJourneyChart } from "./emotional-journey-chart"
import { ExceptionsFeedCard } from "./exceptions-feed-card"
import { KolbTeamScatter } from "./kolb-team-scatter"
import { LoopImpactCard } from "./loop-impact-card"
import { ModuleEngagementChart } from "./module-engagement-chart"
import { ModuleFunnelCombined } from "./module-funnel-combined"
import { type ModuleReflectionStats, ReflectionAnalytics } from "./reflection-analytics"
import { WeeklySessionsChart } from "./session-journey-chart"
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

interface AnalyticsTeamScope {
  mode: "direct" | "hierarchy"
  focusUserId: string | null
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
  isManagerLensView?: boolean
  teamScope?: AnalyticsTeamScope
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

/**
 * Consolidated "está tudo bem?" numbers for the Uso HeroStat. Mirrors the math
 * of the old SummaryOverview (activePct / completionPct / sessions-per-student)
 * so the redesign shows the same values — just promoted to a single hero.
 *
 * `approximate` is true when we sum across more than one unit: a student in two
 * areas is counted twice, inflating the denominators (documented limitation in
 * summary-overview.tsx). Per spec §6.1 that number must be visibly flagged, not
 * silently presented as exact.
 */
function aggregateUsoStats(
  units: UnitStats[],
  selectedAreaName?: string,
): { activePct: number; completionPct: number; sessionsPerStudent: number; approximate: boolean } {
  const single = selectedAreaName ? units.find((u) => u.areaName === selectedAreaName) : undefined
  const scope = single
    ? single
    : units.reduce(
        (acc, u) => ({
          areaName: "Total",
          totalStudents: acc.totalStudents + u.totalStudents,
          activeStudents: acc.activeStudents + u.activeStudents,
          completedSessions: acc.completedSessions + u.completedSessions,
          totalSessions: acc.totalSessions + u.totalSessions,
          reflectionCount: acc.reflectionCount + u.reflectionCount,
          avgSessionsPerStudent: 0,
          completionPct: 0,
        }),
        {
          areaName: "Total",
          totalStudents: 0,
          activeStudents: 0,
          completedSessions: 0,
          totalSessions: 0,
          reflectionCount: 0,
          avgSessionsPerStudent: 0,
          completionPct: 0,
        } as UnitStats,
      )

  const activePct =
    scope.totalStudents > 0 ? Math.round((scope.activeStudents / scope.totalStudents) * 100) : 0
  const completionPct =
    scope.totalSessions > 0 ? Math.round((scope.completedSessions / scope.totalSessions) * 100) : 0
  const sessionsPerStudent =
    scope.totalStudents > 0 ? Number((scope.totalSessions / scope.totalStudents).toFixed(1)) : 0

  return { activePct, completionPct, sessionsPerStudent, approximate: !single && units.length > 1 }
}

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
  isManagerLensView = false,
  teamScope,
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uso")
  const [period, setPeriod] = useState("30d")
  const [courseId, setCourseId] = useState("")
  const [areaId, setAreaId] = useState(isManagerLensView ? "" : (initialAreaId ?? ""))
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
    setAreaId(isManagerLensView ? "" : (initialAreaId ?? ""))
    setStudentSearch("")
  }, [initialAreaId, isManagerLensView])
  // Item 8 — corporate unit selector state. null = all units (default fan-out).
  // SCOPE BOUNDARY: corporateUnitFilter only narrows the client-side comparison
  // fetch (/api/analytics/manager-groups). It does NOT re-scope the SSR props
  // (unitStats/unitDepthComparison) — those follow the header Unidade cookie
  // (initialAreaId) only. A corporate gestor narrowing here won't reshape the
  // Aprendizagem SSR cards; use the header Unidade selector for full scoping.
  // TODO(follow-up): unify corporate narrowing with server scope if needed.
  const [corporateUnitFilter, setCorporateUnitFilter] = useState<string | null>(null)

  // Redesign UI state (presentation only — no effect on data/scope).
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [usoModuleView, setUsoModuleView] = useState<"funil" | "engajamento">("funil")
  const [depthView, setDepthView] = useState<"distribuicao" | "evolucao">("distribuicao")

  // Modes allowed for this role (1.2 — fixed rules, no config screen)
  const allowedModes = MODES_BY_ROLE[userRole] as readonly ComparisonMode[]

  const { data, isLoading, isError } = useQuery<AggregateAnalyticsResponse>({
    queryKey: [
      "analytics-aggregate",
      period,
      courseId,
      areaId,
      interactionType,
      teamScope?.mode,
      teamScope?.focusUserId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (courseId) params.set("courseId", courseId)
      if (areaId && !isManagerLensView) params.set("areaId", areaId)
      if (interactionType) params.set("interactionType", interactionType)
      if (isManagerLensView && teamScope) {
        if (teamScope.mode === "hierarchy") params.set("includeSubtree", "true")
        if (teamScope.focusUserId) params.set("focusUserId", teamScope.focusUserId)
      }
      const r = await fetch(`/api/analytics/aggregate?${params.toString()}`)
      if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData: undefined, // Always fetch from API to get temporal deltas
  })

  // Item 1.2 — fetch comparison data (areas + managers) for UnitComparison modes
  // Item 8 — pass unitFilter when corporate selector is active
  const { data: comparisonData } = useQuery<ComparisonResponse>({
    queryKey: [
      "analytics-comparison",
      period,
      areaId,
      courseId,
      corporateUnitFilter,
      isManagerLensView,
    ],
    enabled: !isManagerLensView,
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
  const visibleUnitStats: UnitStats[] = isManagerLensView ? [] : unitStats

  const searchLower = studentSearch.toLowerCase()
  const isSearching = searchLower.length > 1

  // Resolve area name from areaId for client-side filtering. Falls back to the
  // server-authoritative scopedAreaName so the label stays correct even if the
  // `areas` prop lags behind `initialAreaId` during a revalidation frame.
  const selectedAreaName = useMemo(() => {
    if (isManagerLensView) return ""
    if (!areaId) return ""
    return areas.find((a) => a.id === areaId)?.name ?? scopedAreaName ?? ""
  }, [areaId, areas, scopedAreaName, isManagerLensView])

  // Area-filtered roster (before search).
  // When the server already scoped to a unit (isAreaScoped), the roster IS the
  // unit's roster — re-filtering by area name here would wrongly drop students
  // who belong to more than one area. We only fall back to name-filtering when
  // the server is NOT scoped (legacy/no-cookie path).
  const areaFilteredRoster = useMemo(() => {
    if (isManagerLensView) return rosterStudents
    if (isAreaScoped) return rosterStudents
    if (!selectedAreaName) return rosterStudents
    return rosterStudents.filter((s) => s.areaName === selectedAreaName)
  }, [rosterStudents, selectedAreaName, isAreaScoped, isManagerLensView])

  // Area-filtered student names (for module stats filtering). Null = no client
  // filter; when server-scoped, moduleStats reflections are already narrowed.
  const areaStudentNames = useMemo(() => {
    if (isManagerLensView) return null
    if (isAreaScoped) return null
    if (!selectedAreaName) return null
    return new Set(areaFilteredRoster.map((s) => s.name))
  }, [areaFilteredRoster, selectedAreaName, isAreaScoped, isManagerLensView])

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
    !isManagerLensView &&
    (visibleUnitStats.length >= 2 || areaStats.length >= 2 || courseStats.length >= 2)

  const usoScope = isManagerLensView ? undefined : scopedAreaName || selectedAreaName || undefined

  return (
    <div className="space-y-8">
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />

      {/* Faixa de Escopo Unificada (spec §2.6) — every "o que estou vendo"
          control lives in one Tier-3 strip instead of floating separately. */}
      <ScopeBar onOpenGlossary={() => setGlossaryOpen(true)}>
        <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />

        {isAreaScoped && scopedAreaName && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-card px-2.5 py-1 text-xs text-text-secondary">
            <Building2 size={13} className="text-cerrado-600" aria-hidden="true" />
            {scopedAreaName}
          </span>
        )}

        {activeTab === "alunos" && (
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Buscar aluno…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-52 rounded-md bg-bg-card py-1.5 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cerrado-600/40"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setStudentSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-cerrado-600"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Filtro de curso — só na aba Uso, onde de fato filtra algo (spec §2). */}
        {activeTab === "uso" && courses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setCourseId("")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${!courseId ? "bg-cerrado-600 text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}
            >
              Todos os cursos
            </button>
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseId(courseId === c.id ? "" : c.id)}
                className={`max-w-[200px] truncate rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${courseId === c.id ? "bg-cerrado-600 text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"}`}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}

        {/* Seletor de unidade corporativa — só Uso, gestores com >1 unidade. */}
        {activeTab === "uso" && hasCorporateGroup && corporateSpannedUnits.length >= 2 && (
          <div className="relative inline-flex items-center">
            <Building2 size={13} className="mr-1 text-cerrado-600" aria-hidden="true" />
            <select
              value={corporateUnitFilter ?? "all"}
              onChange={(e) =>
                setCorporateUnitFilter(e.target.value === "all" ? null : e.target.value)
              }
              className="cursor-pointer appearance-none rounded-md bg-bg-card py-1 pl-2 pr-6 text-[11px] font-medium text-text-primary transition-colors hover:text-cerrado-600 focus:outline-none"
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
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-text-muted/50"
              aria-hidden="true"
            />
          </div>
        )}
      </ScopeBar>

      {/* Tabs — sublinhado + peso tipográfico, não pill preenchido (spec §2).
          `cerrado` fica reservado para a única aba ativa. */}
      <nav className="flex items-center gap-6 border-b border-border-subtle" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm transition-colors ${
                active
                  ? "border-cerrado-600 font-semibold text-text-primary"
                  : "border-transparent font-normal text-text-muted hover:text-text-secondary"
              }`}
            >
              {active && <Icon size={15} aria-hidden="true" />}
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Skeleton (spec §2) — mesmo formato do conteúdo que vai aparecer. */}
      {isFetching && (
        <div className="space-y-6" aria-hidden="true">
          <div className="h-44 animate-pulse rounded-2xl bg-bg-elevated" />
          <div className="h-28 animate-pulse rounded-xl bg-bg-elevated" />
          <div className="h-28 animate-pulse rounded-xl bg-bg-elevated" />
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          Falha ao carregar dados.
        </div>
      )}

      {/* ═══════════════════ TAB: USO DA PLATAFORMA ═══════════════════ */}
      {activeTab === "uso" &&
        (() => {
          const uso = aggregateUsoStats(visibleUnitStats, usoScope)
          const engagementRate = currentData.summary.engagementRate ?? 0
          const usageInsights = generateUsageInsights({
            totalSessions: currentData.summary.totalSessions,
            deltaSessions: currentData.summary.deltaSessions,
            engagementRate: currentData.summary.engagementRate,
            rosterStudents: areaFilteredRoster,
            unitStats: visibleUnitStats,
          })
          const usageAiMetrics = {
            totalSessions: currentData.summary.totalSessions,
            deltaSessions: currentData.summary.deltaSessions,
            engagementRate: currentData.summary.engagementRate,
            totalStudents: areaFilteredRoster.length,
            neverAccessed: areaFilteredRoster.filter((s) => s.risk === "never_accessed").length,
            inactive: areaFilteredRoster.filter((s) => s.risk === "inactive").length,
            units: visibleUnitStats.map((u) => ({
              name: u.areaName,
              activePct:
                u.totalStudents > 0 ? Math.round((u.activeStudents / u.totalStudents) * 100) : 0,
              completionPct: u.completionPct,
            })),
          }
          const reflIndexPct = currentData.indicators?.total.reflectionIndexPct ?? null
          const socIndexPct = currentData.indicators?.total.socraticIndexPct ?? null
          const mostActive = [...areaFilteredRoster]
            .filter((s) => s.totalSessions > 0)
            .sort((a, b) => b.completedSessions - a.completedSessions)
            .slice(0, 5)
          const needNudge = areaFilteredRoster
            .filter((s) => s.risk === "never_accessed" || s.risk === "inactive")
            .slice(0, 5)

          return (
            <div className="space-y-8">
              {/* 1 — Card Display: a pergunta única da aba (spec §3.1) */}
              <HeroStat
                question="Meu time está engajado esta semana?"
                value={`${uso.activePct}%`}
                approximate={uso.approximate}
                secondary={[
                  { label: "Conclusão", value: `${uso.completionPct}%` },
                  { label: "Sessões por aluno", value: uso.sessionsPerStudent.toFixed(1) },
                  { label: "Engajamento", value: `${engagementRate}%` },
                ]}
              />

              {/* 2 — O que fazer agora (insights de regra + IA unificados) */}
              <ActionInsightCard insights={usageInsights} aiTab="uso" aiMetrics={usageAiMetrics} />

              {/* 2.1 — O loop que você causou (mock analytics-apple/model-melhorado) */}
              <LoopImpactCard loopStats={currentData.loopStats} />

              {/* 2.2 — Feed de exceções (mock analytics-apple/model-melhorado) */}
              <ExceptionsFeedCard items={currentData.exceptionsFeed ?? []} />

              {/* 2.3 — Distribuição de profundidade (mock analytics-apple/model-melhorado) */}
              <DepthDistributionChart data={currentData.depthDistribution} />

              {/* 3 — Sessões por semana (Tier 2) */}
              {sessionsByWeek.length > 0 && <WeeklySessionsChart data={sessionsByWeek} />}

              {/* 4 — Modos de interação (Tier 2, neutro + % como diferenciador) */}
              {filteredInteractionModes.length > 0 && (
                <section className="space-y-4 rounded-xl border border-border-subtle bg-bg-card p-6 shadow-elevation-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Modos de interação
                  </h3>
                  <div className="space-y-3">
                    {filteredInteractionModes.map((mode) => {
                      const pct =
                        totalInteractions > 0
                          ? Math.round((mode.count / totalInteractions) * 100)
                          : 0
                      return (
                        <div key={mode.mode}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm text-text-secondary">{mode.label}</span>
                            <span className="text-sm font-semibold tabular-nums text-text-primary">
                              {pct}%{" "}
                              <span className="text-xs font-normal text-text-muted">
                                · {mode.count} sessões
                              </span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                            <div
                              className="h-full rounded-full bg-text-muted/40"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* 5 — Ver por módulo (funil / engajamento, fechado) */}
              {(filteredModuleAccess.length > 0 || filteredProgressFunnel.length > 0) && (
                <Accordion
                  title="Ver por módulo"
                  subtitle="Funil de progresso e engajamento por capítulo"
                  right={
                    <ToggleGroup
                      ariaLabel="Visualização por módulo"
                      value={usoModuleView}
                      onChange={setUsoModuleView}
                      options={[
                        { value: "funil", label: "Funil" },
                        { value: "engajamento", label: "Engajamento" },
                      ]}
                    />
                  }
                >
                  {usoModuleView === "funil" ? (
                    <ModuleFunnelCombined
                      moduleAccess={filteredModuleAccess}
                      progressFunnel={filteredProgressFunnel}
                    />
                  ) : (
                    <ModuleEngagementChart
                      moduleAccess={filteredModuleAccess}
                      indicators={currentData.indicators?.perModule}
                    />
                  )}
                </Accordion>
              )}

              {/* 6 — Comparar unidades (fechado) */}
              {showUnitComparison && (
                <Accordion
                  title="Comparar unidades"
                  subtitle="Ativos, conclusão e sessões por unidade / área / curso"
                >
                  <UnitComparison
                    units={visibleUnitStats}
                    areaStats={areaStats}
                    courseStats={courseStats}
                    allowedModes={allowedModes}
                  />
                </Accordion>
              )}

              {/* 7 — Mais métricas (índices, fechado) */}
              {(reflIndexPct !== null || socIndexPct !== null) && (
                <Accordion
                  title="Mais métricas"
                  subtitle="Índices de reflexão e socrático do currículo"
                >
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="font-display text-2xl font-semibold tabular-nums text-text-primary">
                        {reflIndexPct !== null ? `${reflIndexPct}%` : "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">Índice de Reflexões</p>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-semibold tabular-nums text-text-primary">
                        {socIndexPct !== null ? `${socIndexPct}%` : "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">Índice Socrático</p>
                    </div>
                  </div>
                </Accordion>
              )}

              {/* 8 — Alunos por engajamento (adição do Senhor) */}
              {areaFilteredRoster.length > 0 && (
                <Accordion
                  title="Ver alunos por engajamento"
                  subtitle="Quem está puxando o ritmo e quem precisa de um empurrão"
                >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Puxando o ritmo
                      </p>
                      {mostActive.length === 0 ? (
                        <p className="text-sm text-text-muted">Sem sessões no período.</p>
                      ) : (
                        <ul className="space-y-2">
                          {mostActive.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2.5">
                              <span className="w-4 text-right text-[10px] font-semibold tabular-nums text-text-muted">
                                {i + 1}
                              </span>
                              <span className="flex-1 truncate text-sm text-text-primary">
                                {s.name}
                              </span>
                              <span className="text-xs tabular-nums text-text-muted">
                                {s.completedSessions}s · {s.reflectionsCount}r
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Precisam de um empurrão
                      </p>
                      {needNudge.length === 0 ? (
                        <p className="text-sm text-text-muted">
                          Ninguém inativo ou sem acesso no momento.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {needNudge.map((s) => (
                            <li key={s.id} className="flex items-center gap-2.5">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${s.risk === "never_accessed" ? "bg-semantic-error" : "bg-semantic-warning"}`}
                                aria-hidden="true"
                              />
                              <span className="flex-1 truncate text-sm text-text-primary">
                                {s.name}
                              </span>
                              <span className="text-xs text-text-muted">
                                {s.risk === "never_accessed"
                                  ? "nunca acessou"
                                  : s.daysSinceLastActivity !== null
                                    ? `há ${s.daysSinceLastActivity}d`
                                    : "inativo"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </Accordion>
              )}
            </div>
          )
        })()}

      {/* ═══════════════════ TAB: APRENDIZAGEM ═══════════════════ */}
      {activeTab === "aprendizagem" &&
        (() => {
          const depthDelta =
            currentData.summary.deltaDepth !== null
              ? Math.round(
                  (currentData.summary.deltaDepth * 100) /
                    Math.max(currentData.summary.avgDepth, 1),
                )
              : null
          const learningInsights = generateLearningInsights({
            avgDepth: currentData.summary.avgDepth,
            totalReflections,
            totalStudents,
            moduleStats,
          })
          const learningAiMetrics = {
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
          }
          const bestDepthUnit =
            unitDepthComparison.length > 0
              ? unitDepthComparison.reduce((a, b) => (a.avgDepth > b.avgDepth ? a : b))
              : null

          return (
            <div className="space-y-8">
              {/* 1 — Card Display: a pergunta única da aba */}
              <HeroStat
                question="O raciocínio está aprofundando?"
                value={currentData.summary.avgDepth}
                unit="/7"
                delta={depthDelta}
                secondary={[
                  {
                    label: "Breakthroughs por sessão",
                    value: currentData.summary.avgBreakthroughsPerSession,
                  },
                ]}
              />

              {/* 2 — O que fazer agora */}
              <ActionInsightCard
                insights={learningInsights}
                aiTab="aprendizagem"
                aiMetrics={learningAiMetrics}
              />

              {/* 3 — Alertas de atenção (Tier 2, acionável) */}
              {currentData.alerts.length > 0 && <AlertAttentionList alerts={currentData.alerts} />}

              {/* 4 — Profundidade: distribuição / evolução (toggle) */}
              <section className="space-y-4 rounded-xl border border-border-subtle bg-bg-card p-6 shadow-elevation-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Profundidade do raciocínio
                  </h3>
                  <ToggleGroup
                    ariaLabel="Visualização de profundidade"
                    value={depthView}
                    onChange={setDepthView}
                    options={[
                      { value: "distribuicao", label: "Distribuição" },
                      { value: "evolucao", label: "Evolução" },
                    ]}
                  />
                </div>
                {depthView === "distribuicao" ? (
                  <DepthDistributionChart data={currentData.depthDistribution} />
                ) : depthByWeek.some((w) => w.avgDepth > 0) ? (
                  <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                    {depthByWeek.map((w, i) => {
                      const h = (w.avgDepth / 7) * 100
                      const isLast = i === depthByWeek.length - 1
                      return (
                        <div
                          key={w.week}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        >
                          {w.avgDepth > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums text-text-primary">
                              {w.avgDepth}
                            </span>
                          )}
                          <div
                            className={`w-full rounded-t-md ${isLast ? "bg-text-secondary/70" : w.avgDepth > 0 ? "bg-text-muted/40" : "bg-bg-elevated"}`}
                            style={{ height: `${Math.max(h, w.avgDepth > 0 ? 10 : 4)}%` }}
                          />
                          <span className="text-[9px] text-text-muted">{w.week}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-text-muted">
                    Sem dados de profundidade no período.
                  </p>
                )}
              </section>

              {/* 5 — Fase Consciência (condicional) */}
              {consciousnessStats && consciousnessStats.totalPre > 0 && (
                <Accordion
                  title="Fase Consciência"
                  subtitle="Roda do Aprendizado — autoavaliação pré e pós"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-bg-elevated p-4">
                      <p className="text-xs font-medium text-text-muted">Alunos que responderam</p>
                      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
                        {consciousnessStats.uniqueStudents}
                      </p>
                      <p className="text-xs text-text-muted">
                        {consciousnessStats.totalPre} respostas pré-curso
                      </p>
                    </div>
                    <div className="rounded-lg bg-bg-elevated p-4">
                      <p className="text-xs font-medium text-text-muted">
                        Autoavaliação média (pré)
                      </p>
                      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
                        {consciousnessStats.avgPreRating}
                        <span className="text-sm text-text-muted">/5</span>
                      </p>
                      <p className="text-xs text-text-muted">Nível de partida dos alunos</p>
                    </div>
                    <div className="rounded-lg bg-bg-elevated p-4">
                      <p className="text-xs font-medium text-text-muted">Evolução média</p>
                      <p
                        className={`mt-1 font-display text-2xl font-semibold tabular-nums ${consciousnessStats.avgDelta !== null && consciousnessStats.avgDelta > 0 ? "text-semantic-success" : "text-text-primary"}`}
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
                      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-text-primary">
                        {consciousnessStats.completionRate}%
                      </p>
                      <p className="text-xs text-text-muted">Pré → Pós (ritual completo)</p>
                    </div>
                  </div>
                </Accordion>
              )}

              {/* 6 — Ver por módulo (extensão média das reflexões) */}
              {wordsPerModule.length > 0 && (
                <Accordion
                  title="Ver por módulo"
                  subtitle="Extensão média das reflexões (palavras por resposta)"
                >
                  <div className="space-y-2.5">
                    {wordsPerModule
                      .filter((m) => m.reflectionCount > 0)
                      .map((m) => {
                        const maxWords = Math.max(...wordsPerModule.map((w) => w.avgWords), 1)
                        const barW = (m.avgWords / maxWords) * 100
                        return (
                          <div key={m.chapterTitle}>
                            <div className="mb-0.5 flex items-center justify-between">
                              <span className="flex-1 truncate text-sm text-text-secondary">
                                {m.chapterTitle}
                              </span>
                              <span className="ml-2 shrink-0 text-xs font-semibold tabular-nums text-text-primary">
                                ~{m.avgWords} palavras
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                              <div
                                className="h-full rounded-full bg-text-muted/40"
                                style={{ width: `${barW}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-text-muted">
                              {m.reflectionCount} reflexões
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </Accordion>
              )}

              {/* 7 — Comparar unidades (profundidade) */}
              {!isManagerLensView && unitDepthComparison.length >= 2 && (
                <Accordion title="Comparar unidades" subtitle="Profundidade média por unidade">
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${unitDepthComparison.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {unitDepthComparison.map((u) => {
                      const isBest =
                        bestDepthUnit !== null &&
                        u.areaName === bestDepthUnit.areaName &&
                        u.avgDepth > 0
                      return (
                        <div
                          key={u.areaName}
                          className={`space-y-3 rounded-xl bg-bg-elevated p-4 ${isBest ? "ring-1 ring-cerrado-600/30" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-text-primary">{u.areaName}</p>
                            {isBest && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-cerrado-600">
                                melhor
                              </span>
                            )}
                          </div>
                          <div className="py-1 text-center">
                            <p className="font-display text-3xl font-bold tabular-nums text-text-primary">
                              {u.avgDepth}
                              <span className="text-sm font-normal text-text-muted">/7</span>
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase text-text-muted">
                              Profundidade média
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-t border-border-subtle pt-2">
                            <div className="text-center">
                              <p className="text-sm font-semibold tabular-nums text-text-primary">
                                {u.sessionsAnalyzed}
                              </p>
                              <p className="text-[9px] text-text-muted">Sessões</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold tabular-nums text-text-primary">
                                {u.reflectionCount}
                              </p>
                              <p className="text-[9px] text-text-muted">Reflexões</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold tabular-nums text-text-primary">
                                {u.studentCount}
                              </p>
                              <p className="text-[9px] text-text-muted">Alunos</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Accordion>
              )}

              {/* 8 — Ver reflexões dos alunos */}
              <Accordion
                title="Ver reflexões dos alunos"
                subtitle="Participação e texto das reflexões por módulo"
              >
                <ReflectionAnalytics
                  modules={filteredModuleStats}
                  totalReflections={filteredTotalReflections}
                  totalStudents={areaStudentNames ? areaStudentNames.size : totalStudents}
                />
              </Accordion>

              {/* 9 — Ver estilos de aprendizagem */}
              {currentData.kolbTeam.length > 0 && (
                <Accordion
                  title="Ver estilos de aprendizagem"
                  subtitle="Ciclo de Kolb e divergência teste × IA"
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <KolbTeamScatter data={currentData.kolbTeam} />
                    <DivergenceComparisonTable data={currentData.divergenceTable} />
                  </div>
                </Accordion>
              )}

              {/* 10 — Ver padrões cognitivos */}
              {(currentData.cognitivePatterns.length > 0 ||
                currentData.emotionalJourney.length > 0) && (
                <Accordion
                  title="Ver padrões cognitivos"
                  subtitle="Padrões de raciocínio e jornada emocional"
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    {currentData.cognitivePatterns.length > 0 && (
                      <CognitivePatternsChart data={currentData.cognitivePatterns} />
                    )}
                    {currentData.emotionalJourney.length > 0 && (
                      <EmotionalJourneyChart data={currentData.emotionalJourney} />
                    )}
                  </div>
                </Accordion>
              )}
            </div>
          )
        })()}

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
          const topEngaged = [...baseRoster]
            .filter((s) => s.totalSessions > 0)
            .sort(
              (a, b) =>
                b.completedSessions * 2 +
                b.reflectionsCount -
                (a.completedSessions * 2 + a.reflectionsCount),
            )
            .slice(0, 5)
          const rosterList = isSearching || selectedAreaName ? filteredRoster : baseRoster

          return (
            <div className="space-y-8">
              {/* Linha de stats inline (Tier 3) — some durante a busca */}
              {!isSearching && (
                <StatRow
                  items={[
                    { label: "alunos", value: baseRoster.length },
                    { label: "ativos (7d)", value: active7d },
                    { label: "ativos (30d)", value: active30d },
                    { label: "nunca acessaram", value: neverCount },
                  ]}
                />
              )}
              {isSearching && (
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{filteredRoster.length}</span>{" "}
                  resultado(s) para “{studentSearch}”
                </p>
              )}

              {/* Card Display da aba: a pergunta única + o roster (Saúde do Time) */}
              <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold text-text-muted">
                  Quem precisa da minha atenção agora?
                </h2>
                <StudentRoster
                  students={rosterList}
                  totalChapters={totalChapters}
                  avgSessions={avgSessions}
                  avgReflections={avgReflections}
                />
              </div>

              {/* Ver mapa de progresso (heatmap — glifo + cor, spec §5.1) */}
              {!isSearching && studentModuleHeatmap.length > 0 && moduleNames.length > 0 && (
                <Accordion
                  title="Ver mapa de progresso"
                  subtitle="Aluno × módulo — concluído, iniciado ou não iniciado"
                >
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="mb-1 ml-[140px] flex items-end gap-0.5">
                        {moduleNames.map((name) => (
                          <div key={name} className="min-w-[40px] flex-1">
                            <span
                              className="block truncate text-[7px] leading-tight text-text-muted"
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
                      <div className="space-y-0.5">
                        {studentModuleHeatmap.map((row, idx) => (
                          <div
                            key={`${row.studentName}-${idx}`}
                            className="flex items-center gap-0.5"
                          >
                            <span className="w-[140px] shrink-0 truncate pr-2 text-[9px] text-text-secondary">
                              {row.studentName}
                            </span>
                            {row.modules.map((m) => (
                              <div
                                key={m.chapterTitle}
                                className={`flex h-5 min-w-[40px] flex-1 items-center justify-center rounded-sm text-[9px] font-semibold ${
                                  m.status === "completed"
                                    ? "bg-semantic-success/80 text-white"
                                    : m.status === "started"
                                      ? "bg-semantic-warning/70 text-black/70"
                                      : "bg-bg-elevated text-text-muted"
                                }`}
                                title={`${row.studentName} — ${m.chapterTitle}: ${m.status === "completed" ? "Concluído" : m.status === "started" ? "Iniciado" : "Não iniciado"}`}
                              >
                                {m.status === "completed" ? "✓" : m.status === "started" ? "●" : ""}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 ml-[140px] flex items-center gap-4">
                        <span className="flex items-center gap-1 text-[9px] text-text-muted">
                          <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-semantic-success/80 text-[7px] text-white">
                            ✓
                          </span>{" "}
                          Concluído
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-text-muted">
                          <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-semantic-warning/70 text-[7px] text-black/70">
                            ●
                          </span>{" "}
                          Iniciado
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-text-muted">
                          <span className="h-3 w-3 rounded-sm bg-bg-elevated" /> Não iniciado
                        </span>
                      </div>
                    </div>
                  </div>
                </Accordion>
              )}

              {/* Ver mais engajados (reconhecimento positivo, não urgência) */}
              {!isSearching && topEngaged.length > 0 && (
                <Accordion
                  title="Ver mais engajados"
                  subtitle="Reconhecimento — quem mais avançou no período"
                >
                  <ul className="space-y-2">
                    {topEngaged.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2.5">
                        <span className="w-4 text-right text-[10px] font-semibold tabular-nums text-text-muted">
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-text-primary">{s.name}</span>
                        <span className="text-xs tabular-nums text-text-muted">
                          {s.completedSessions}s · {s.reflectionsCount}r
                        </span>
                      </li>
                    ))}
                  </ul>
                </Accordion>
              )}

              {/* Comparar unidades (compartilhado com as outras abas) */}
              {!isSearching && showUnitComparison && (
                <Accordion
                  title="Comparar unidades"
                  subtitle="Distribuição de alunos e engajamento por unidade"
                >
                  <UnitComparison
                    units={visibleUnitStats}
                    areaStats={areaStats}
                    courseStats={courseStats}
                    allowedModes={allowedModes}
                  />
                </Accordion>
              )}
            </div>
          )
        })()}
    </div>
  )
}
