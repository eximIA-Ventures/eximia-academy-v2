"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { CourseAnalyticsTable } from "./course-analytics-table"
import { CsvExportButton } from "./csv-export-button"
import { EngagementChart } from "./engagement-chart"
import { PeriodFilter } from "./period-filter"
import type { ManagerAnalytics } from "./types"

interface ManagerDashboardClientProps {
  initialData: ManagerAnalytics
  aiDetectionEnabled: boolean
  courses: Array<{ id: string; title: string }>
  /**
   * Diretos/Hierarquia + E9 focus (Iteração 2, 2026-07-02 — closes the
   * "Mudança 4" gap): `/api/analytics/manager` used to be COMPLETELY unaware
   * of the team-view mode. On any refetch (period/course change — see the
   * `useQuery` below), it fell back to its own legacy `includeSubtree` param
   * scheme (always `false` unless explicitly set), which for a manager with
   * ZERO explicit `manager_group` ownership (e.g. Rinaldo, who reaches
   * students purely via `reports_to`) resolved to an EMPTY scope — zeros on
   * screen the moment a manager touched the period/course filter, even though
   * the FIRST paint (this component's `initialData`, computed server-side
   * with the correct scope) was correct. Passing mode+focus here keeps every
   * refetch aligned with what the rest of the "Meu Time" screen shows.
   */
  teamViewMode?: "direct" | "hierarchy"
  focusUserId?: string | null
}

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
  { label: "Tudo", value: "all" },
]

export function ManagerDashboardClient({
  initialData,
  aiDetectionEnabled,
  courses,
  teamViewMode,
  focusUserId,
}: ManagerDashboardClientProps) {
  const [period, setPeriod] = useState("30d")
  const [courseFilter, setCourseFilter] = useState("")

  const queryParams = new URLSearchParams({ period })
  if (courseFilter) queryParams.set("courseId", courseFilter)
  if (teamViewMode) queryParams.set("mode", teamViewMode)
  if (focusUserId) queryParams.set("focusUserId", focusUserId)

  const { data } = useQuery<ManagerAnalytics>({
    queryKey: ["manager-analytics", period, courseFilter, teamViewMode, focusUserId],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/manager?${queryParams.toString()}`)
      if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData: period === "30d" && !courseFilter ? initialData : undefined,
  })

  const chartData = data?.engagementChart ?? initialData.engagementChart
  const courseTable = data?.courseTable ?? initialData.courseTable

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Analytics</h2>
        <div className="flex items-center gap-3">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filtrar por curso"
            className="rounded-md shadow-card bg-bg-surface px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          <CsvExportButton
            data={courseTable}
            aiDetectionEnabled={aiDetectionEnabled}
            courseFilter={courseFilter || undefined}
          />
        </div>
      </div>

      <EngagementChart data={chartData} />

      <CourseAnalyticsTable courses={courseTable} aiDetectionEnabled={aiDetectionEnabled} />
    </div>
  )
}
