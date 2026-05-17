"use client"

import { Input, Select } from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
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
}

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
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
}: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState("30d")
  const [courseId, setCourseId] = useState("")
  const [areaId, setAreaId] = useState(initialAreaId ?? "")
  const [interactionType, setInteractionType] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  const [showFullRoster, setShowFullRoster] = useState(false)

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

  // Cross-filter: when student search is active, filter reflections and roster
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

  return (
    <div className="space-y-6">
      {/* Global filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text-primary shrink-0">Métricas da Turma</h2>
          {/* Student search — PowerBI style cross-filter */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full rounded-lg bg-bg-elevated border-0 pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cerrado-600/30"
            />
            {isSearching && (
              <button type="button" onClick={() => setStudentSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cerrado-600 font-medium">
                Limpar
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Filtrar por curso" selectSize="sm">
            <option value="">Todos os cursos</option>
            {courses.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
          </Select>
          <Select value={interactionType} onChange={(e) => setInteractionType(e.target.value)} aria-label="Filtrar por modo" selectSize="sm">
            <option value="">Todos os modos</option>
            <option value="socratic_dialogue">Socrático</option>
            <option value="quiz">Quiz</option>
            <option value="scenario">Cenário</option>
            <option value="assignment">Atividade</option>
          </Select>
          <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>
      </div>

      {/* Search active indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cerrado-600/5 border border-cerrado-600/10">
          <Search size={12} className="text-cerrado-600" />
          <span className="text-xs text-cerrado-600 font-medium">
            Filtrando por "{studentSearch}" — {filteredRoster.length} aluno(s) encontrado(s)
          </span>
        </div>
      )}

      {/* Loading/Error */}
      {isFetching && <p className="text-center text-sm text-text-muted">Carregando dados...</p>}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          Falha ao carregar dados. Tente novamente.
        </div>
      )}

      {/* Summary cards */}
      <SummaryCardsRow summary={currentData.summary} />

      {/* Unit comparison */}
      {unitStats.length >= 2 && !isSearching && <UnitComparison units={unitStats} />}

      {/* Depth distribution */}
      <DepthDistributionChart data={currentData.depthDistribution} />

      {/* Reflection analytics */}
      <ReflectionAnalytics
        modules={filteredModuleStats}
        totalReflections={filteredTotalReflections}
        totalStudents={totalStudents}
      />

      {/* Alerts */}
      {currentData.alerts.length > 0 && !isSearching && (
        <AlertAttentionList alerts={currentData.alerts} />
      )}

      {/* Saúde da Turma — por último, colapsável */}
      {rosterStudents.length > 0 && (
        <StudentRoster students={isSearching ? filteredRoster : rosterStudents} totalChapters={totalChapters} />
      )}

      {/* Advanced analytics — only if data exists */}
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
  )
}
