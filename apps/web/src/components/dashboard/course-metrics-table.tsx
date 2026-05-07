"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import { StatusBadge } from "./status-badge"
import { StudentMetricsTable } from "./student-metrics-table"
import type { StudentMetric } from "./types"

interface CourseMetric {
  courseId: string
  title: string
  studentCount: number
  completionRate: number
  sessionCount: number
  status: string
}

interface CourseMetricsTableProps {
  courses: CourseMetric[]
  onExpandCourse: (courseId: string) => void
  expandedCourseId: string | null
  studentMetrics: StudentMetric[] | null
  loadingStudents: boolean
  aiDetectionEnabled: boolean
}

export function CourseMetricsTable({
  courses,
  onExpandCourse,
  expandedCourseId,
  studentMetrics,
  loadingStudents,
  aiDetectionEnabled,
}: CourseMetricsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meus Cursos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className=" text-left text-text-muted">
                <th className="pb-3 pr-4 font-medium" />
                <th className="pb-3 pr-4 font-medium">Título</th>
                <th className="pb-3 pr-4 font-medium">Alunos</th>
                <th className="pb-3 pr-4 font-medium">Conclusão</th>
                <th className="pb-3 pr-4 font-medium">Sessões</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const isExpanded = expandedCourseId === course.courseId
                return (
                  <CourseRow
                    key={course.courseId}
                    course={course}
                    isExpanded={isExpanded}
                    onToggle={() => onExpandCourse(isExpanded ? "" : course.courseId)}
                    studentMetrics={isExpanded ? studentMetrics : null}
                    loadingStudents={isExpanded && loadingStudents}
                    aiDetectionEnabled={aiDetectionEnabled}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CourseRow({
  course,
  isExpanded,
  onToggle,
  studentMetrics,
  loadingStudents,
  aiDetectionEnabled,
}: {
  course: CourseMetric
  isExpanded: boolean
  onToggle: () => void
  studentMetrics: StudentMetric[] | null
  loadingStudents: boolean
  aiDetectionEnabled: boolean
}) {
  return (
    <>
      <tr
        className="cursor-pointer  transition-colors hover:bg-bg-hover"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle()
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`Expandir curso ${course.title}`}
      >
        <td className="py-3 pr-2">
          {isExpanded ? (
            <ChevronDown size={16} className="text-text-muted" />
          ) : (
            <ChevronRight size={16} className="text-text-muted" />
          )}
        </td>
        <td className="py-3 pr-4 font-medium text-text-primary">{course.title}</td>
        <td className="py-3 pr-4 text-text-secondary">{course.studentCount}</td>
        <td className="py-3 pr-4 text-text-secondary">{course.completionRate}%</td>
        <td className="py-3 pr-4 text-text-secondary">{course.sessionCount}</td>
        <td className="py-3">
          <StatusBadge status={course.status as "draft" | "published" | "archived"} size="sm" />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-bg-surface p-4">
            {loadingStudents ? (
              <p className="text-sm text-text-muted">Carregando metricas...</p>
            ) : studentMetrics && studentMetrics.length > 0 ? (
              <StudentMetricsTable
                students={studentMetrics}
                aiDetectionEnabled={aiDetectionEnabled}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-3 h-8 w-8 text-text-muted" />
                <p className="text-sm font-medium text-text-secondary">Nenhum aluno inscrito neste curso</p>
                <p className="mt-1 text-xs text-text-muted">Os alunos aparecerão aqui após a inscrição.</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
