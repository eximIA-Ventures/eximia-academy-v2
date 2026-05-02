import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BookOpen } from "lucide-react"
import type { CourseTableRow } from "./types"

interface CourseAnalyticsTableProps {
  courses: CourseTableRow[]
  aiDetectionEnabled: boolean
}

export function CourseAnalyticsTable({ courses, aiDetectionEnabled }: CourseAnalyticsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cursos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-text-muted">
                <th className="pb-3 pr-4 font-medium">Título</th>
                <th className="pb-3 pr-4 font-medium">Alunos</th>
                <th className="pb-3 pr-4 font-medium">Conclusão</th>
                <th className="pb-3 pr-4 font-medium">Profundidade Reflexão</th>
                {aiDetectionEnabled && <th className="pb-3 font-medium">AI Detection (%)</th>}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.courseId} className="border-b border-border-subtle last:border-0">
                  <td className="py-3 pr-4 font-medium text-text-primary">{course.title}</td>
                  <td className="py-3 pr-4 text-text-secondary">{course.studentCount}</td>
                  <td className="py-3 pr-4 text-text-secondary">{course.completionRate}%</td>
                  <td className="py-3 pr-4 text-text-secondary">
                    {course.avgReflectionDepth.toFixed(1)}
                  </td>
                  {aiDetectionEnabled && (
                    <td className="py-3 text-text-secondary">{course.avgAiDetection}%</td>
                  )}
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td
                    colSpan={aiDetectionEnabled ? 5 : 4}
                    className="py-12 text-center"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <BookOpen className="mb-3 h-10 w-10 text-text-muted" />
                      <p className="text-sm font-medium text-text-secondary">Nenhum curso encontrado</p>
                      <p className="mt-1 text-xs text-text-muted">Os cursos aparecerão aqui quando criados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
