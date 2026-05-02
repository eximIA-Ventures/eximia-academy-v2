import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AiDetectionBadge } from "./ai-detection-badge"
import type { StudentMetric } from "./types"

interface StudentMetricsTableProps {
  students: StudentMetric[]
  aiDetectionEnabled: boolean
}

export function StudentMetricsTable({ students, aiDetectionEnabled }: StudentMetricsTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle text-left text-text-muted">
          <th className="pb-2 pr-4 font-medium">Aluno</th>
          <th className="pb-2 pr-4 font-medium">Progresso</th>
          <th className="pb-2 pr-4 font-medium">Sessões</th>
          <th className="pb-2 font-medium">Última Atividade</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.studentId} className="border-b border-border-subtle last:border-0">
            <td className="py-2 pr-4">
              <span className="flex items-center gap-2 text-text-primary">
                {student.name}
                {aiDetectionEnabled && student.aiDetectionFlags.length > 0 && (
                  <AiDetectionBadge
                    verdict={student.aiDetectionFlags[0].verdict}
                    confidence={student.aiDetectionFlags[0].confidence}
                    enabled={aiDetectionEnabled}
                  />
                )}
              </span>
            </td>
            <td className="py-2 pr-4 text-text-secondary">{student.progress}%</td>
            <td className="py-2 pr-4 text-text-secondary">{student.sessionCount}</td>
            <td className="py-2 text-text-secondary">
              {student.lastActivity
                ? formatDistanceToNow(new Date(student.lastActivity), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
