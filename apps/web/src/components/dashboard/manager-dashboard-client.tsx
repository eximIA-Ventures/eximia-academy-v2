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
}: ManagerDashboardClientProps) {
  const [period, setPeriod] = useState("30d")
  const [courseFilter, setCourseFilter] = useState("")

  const queryParams = new URLSearchParams({ period })
  if (courseFilter) queryParams.set("courseId", courseFilter)

  const { data } = useQuery<ManagerAnalytics>({
    queryKey: ["manager-analytics", period, courseFilter],
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
