"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { CourseMetricsTable } from "./course-metrics-table"
import { PeriodFilter } from "./period-filter"
import type { ManagerCourseAnalytics } from "./types"

interface ManagerCourseDashboardClientProps {
  initialData: ManagerCourseAnalytics
  aiDetectionEnabled: boolean
}

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
]

export function ManagerCourseDashboardClient({
  initialData,
  aiDetectionEnabled,
}: ManagerCourseDashboardClientProps) {
  const [period, setPeriod] = useState("30d")
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  const { data } = useQuery<ManagerCourseAnalytics>({
    queryKey: ["manager-course-analytics", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/manager-courses?period=${period}`)
      if (!r.ok) throw new Error(`Analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData: period === "30d" ? initialData : undefined,
  })

  const { data: studentData, isLoading: loadingStudents } = useQuery<ManagerCourseAnalytics>({
    queryKey: ["manager-course-analytics", period, expandedCourseId],
    queryFn: async () => {
      const r = await fetch(
        `/api/analytics/manager-courses?period=${period}&courseId=${expandedCourseId}`,
      )
      if (!r.ok) throw new Error(`Student metrics fetch failed: ${r.status}`)
      return r.json()
    },
    enabled: !!expandedCourseId,
  })

  const courses = data?.courses ?? initialData.courses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Cursos</h2>
        <PeriodFilter value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>

      <CourseMetricsTable
        courses={courses}
        onExpandCourse={setExpandedCourseId}
        expandedCourseId={expandedCourseId}
        studentMetrics={studentData?.studentMetrics ?? null}
        loadingStudents={loadingStudents}
        aiDetectionEnabled={aiDetectionEnabled}
      />
    </div>
  )
}
