"use client"

import { useTenantSlug } from "@/components/providers/tenant-slug-provider"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Clock, FileQuestion, Plus, Target } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { listCourseQuizzes } from "../actions"

interface Quiz {
  id: string
  title: string
  quiz_type: string
  is_active: boolean
  question_ids: string[]
  time_limit_minutes: number | null
  passing_score: number
  max_attempts: number
  created_at: string
}

const typeConfig = {
  practice: { label: "Pratica", variant: "info" as const },
  exam: { label: "Exame", variant: "error" as const },
  diagnostic: { label: "Diagnostico", variant: "warning" as const },
}

export function QuizList({ courseId, canCreate }: { courseId: string; canCreate: boolean }) {
  const slug = useTenantSlug(); const p = slug ? `/${slug}` : ""
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCourseQuizzes(courseId).then((res) => {
      setQuizzes(res.data as Quiz[])
      setLoading(false)
    })
  }, [courseId])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quizzes</CardTitle>
        {canCreate && (
          <Link href={`${p}/courses/${courseId}/quiz/new`}>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              Novo Quiz
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-text-muted">Carregando...</p>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileQuestion className="mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm font-medium text-text-secondary">Nenhum quiz criado ainda</p>
            <p className="mt-1 text-xs text-text-muted">Crie um quiz para avaliar o aprendizado dos alunos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => {
              const cfg = typeConfig[quiz.quiz_type as keyof typeof typeConfig] ?? typeConfig.practice
              return (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between rounded-md border border-border bg-bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{quiz.title}</span>
                        <Badge variant={cfg.variant} badgeSize="sm">
                          {cfg.label}
                        </Badge>
                        {!quiz.is_active && (
                          <Badge variant="default" badgeSize="sm">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <FileQuestion size={12} />
                          {quiz.question_ids?.length ?? 0} questões
                        </span>
                        {quiz.time_limit_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {quiz.time_limit_minutes} min
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Target size={12} />
                          {quiz.passing_score}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
