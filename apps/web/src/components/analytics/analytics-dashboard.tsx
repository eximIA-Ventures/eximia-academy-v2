"use client"

import { Select } from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import type { AggregateAnalyticsResponse } from "@/types/analytics"
import { AlertAttentionList } from "./alert-attention-list"
import { CognitivePatternsChart } from "./cognitive-patterns-chart"
import { DepthDistributionChart } from "./depth-distribution-chart"
import { DivergenceComparisonTable } from "./divergence-comparison-table"
import { EmotionalJourneyChart } from "./emotional-journey-chart"
import { KolbTeamScatter } from "./kolb-team-scatter"
import { SummaryCardsRow } from "./summary-cards-row"

interface AnalyticsDashboardProps {
  initialData: AggregateAnalyticsResponse
  courses: Array<{ id: string; title: string }>
  areas: Array<{ id: string; name: string }>
  initialAreaId?: string
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
}: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState("30d")
  const [courseId, setCourseId] = useState("")
  const [areaId, setAreaId] = useState(initialAreaId ?? "")

  const { data, isLoading, isError } = useQuery<AggregateAnalyticsResponse>({
    queryKey: ["analytics-aggregate", period, courseId, areaId],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (courseId) params.set("courseId", courseId)
      if (areaId) params.set("areaId", areaId)
      const r = await fetch(`/api/analytics/aggregate?${params.toString()}`)
      if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData: period === "30d" && !courseId && !areaId ? initialData : undefined,
  })

  const currentData = data ?? initialData
  const isFetching = isLoading && !data

  return (
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Métricas da Turma</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value)
              setCourseId("")
            }}
            aria-label="Filtrar por área"
            selectSize="sm"
          >
            <option value="">Todas as areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            aria-label="Filtrar por curso"
            selectSize="sm"
          >
            <option value="">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
          <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>
      </div>

      {/* Loading/Error feedback */}
      {isFetching && (
        <p className="text-center text-sm text-text-muted">Carregando dados...</p>
      )}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          Falha ao carregar dados. Tente novamente.
        </div>
      )}

      {/* Summary cards */}
      <SummaryCardsRow summary={currentData.summary} />

      {/* Charts row 1: Depth + Kolb */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DepthDistributionChart data={currentData.depthDistribution} />
        <KolbTeamScatter data={currentData.kolbTeam} />
      </div>

      {/* Charts row 2: Patterns + Emotional journey */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CognitivePatternsChart data={currentData.cognitivePatterns} />
        <EmotionalJourneyChart data={currentData.emotionalJourney} />
      </div>

      {/* Alerts */}
      <AlertAttentionList alerts={currentData.alerts} />

      {/* Divergence table */}
      <DivergenceComparisonTable data={currentData.divergenceTable} />
    </div>
  )
}
