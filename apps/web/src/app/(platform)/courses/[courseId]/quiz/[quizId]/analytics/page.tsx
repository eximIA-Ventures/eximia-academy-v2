"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { ArrowDown, ArrowUp, BarChart3, CheckCircle, Clock, Users, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getQuizAnalytics } from "./actions"

interface PageProps {
  params: Promise<{ courseId: string; quizId: string }>
}

type Period = "7d" | "30d" | "all"

interface HardestQuestion {
  questionId: string
  text: string
  errorCount: number
  totalAnswers: number
  errorRate: number
}

interface StudentRow {
  studentId: string
  studentName: string
  score: number | null
  timeMinutes: number | null
  attempts: number
  status: string
}

interface AnalyticsData {
  passRate: number | null
  passRateTrend: number | null
  avgScore: number | null
  avgTimeMinutes: number | null
  totalAttempts: number
  scoreDistribution: number[]
  hardestQuestions: HardestQuestion[]
  students: StudentRow[]
}

const statusBadge: Record<string, { label: string; variant: "success" | "error" | "warning" | "info" }> = {
  passed: { label: "Aprovado", variant: "success" },
  failed: { label: "Reprovado", variant: "error" },
  timed_out: { label: "Tempo esgotado", variant: "warning" },
  pending_review: { label: "Em revisao", variant: "info" },
}

export default function QuizAnalyticsPage({ params }: PageProps) {
  const [period, setPeriod] = useState<Period>("all")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(
    (p: Period) => {
      setLoading(true)
      params.then(({ quizId }) => {
        getQuizAnalytics(quizId, p).then((res) => {
          if (res.error) setError(res.error)
          else setData(res.data ?? null)
          setLoading(false)
        })
      })
    },
    [params],
  )

  useEffect(() => {
    loadData(period)
  }, [period, loadData])

  if (error) {
    return (
      <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
        {error}
      </div>
    )
  }

  if (loading || !data) {
    return <p className="py-12 text-center text-sm text-text-muted">Carregando analytics...</p>
  }

  const distributionData = [
    { range: "0-20", count: data.scoreDistribution[0] },
    { range: "20-40", count: data.scoreDistribution[1] },
    { range: "40-60", count: data.scoreDistribution[2] },
    { range: "60-80", count: data.scoreDistribution[3] },
    { range: "80-100", count: data.scoreDistribution[4] },
  ]

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Analytics do Quiz</h2>
        <div className="flex gap-1 rounded-md bg-bg-surface p-1">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pass rate */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-semantic-success" />
              <p className="text-xs text-text-muted">Taxa de Aprovacao</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {data.passRate !== null ? `${Math.round(data.passRate)}%` : "—"}
            </p>
            {data.passRateTrend !== null && (
              <div className="mt-1 flex items-center gap-1">
                {data.passRateTrend >= 0 ? (
                  <ArrowUp size={12} className="text-semantic-success" />
                ) : (
                  <ArrowDown size={12} className="text-semantic-error" />
                )}
                <span
                  className={`text-xs ${data.passRateTrend >= 0 ? "text-semantic-success" : "text-semantic-error"}`}
                >
                  {Math.abs(Math.round(data.passRateTrend))}% vs periodo anterior
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Avg score */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-accent-blue-mid" />
              <p className="text-xs text-text-muted">Nota Media</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {data.avgScore !== null ? `${Math.round(data.avgScore)}%` : "—"}
            </p>
          </CardContent>
        </Card>

        {/* Avg time */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-text-muted" />
              <p className="text-xs text-text-muted">Tempo Medio</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {data.avgTimeMinutes !== null ? `${data.avgTimeMinutes} min` : "—"}
            </p>
          </CardContent>
        </Card>

        {/* Total attempts */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-text-muted" />
              <p className="text-xs text-text-muted">Total Tentativas</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">{data.totalAttempts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Score distribution chart */}
      {data.totalAttempts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuicao de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-bg-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-accent-blue-mid)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hardest questions */}
      {data.hardestQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Questoes Mais Erradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-text-muted">Questao</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Taxa de Erro</th>
                    <th className="pb-2 font-medium text-text-muted">Respostas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hardestQuestions.map((q) => (
                    <tr key={q.questionId} className="border-b border-border/50">
                      <td className="max-w-xs truncate py-2 pr-4 text-text-primary">{q.text}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-bg-surface">
                            <div
                              className="h-full rounded-full bg-semantic-error"
                              style={{ width: `${Math.min(q.errorRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-semantic-error">
                            {Math.round(q.errorRate)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-text-muted">{q.totalAnswers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student table */}
      {data.students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-text-muted">Aluno</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Nota</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Tempo</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Tentativas</th>
                    <th className="pb-2 font-medium text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => {
                    const badge = statusBadge[s.status] ?? {
                      label: s.status,
                      variant: "default" as const,
                    }
                    return (
                      <tr key={s.studentId} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-text-primary">{s.studentName}</td>
                        <td className="py-2 pr-4 font-medium text-text-primary">
                          {s.score !== null ? `${Math.round(s.score)}%` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-text-muted">
                          {s.timeMinutes !== null ? `${s.timeMinutes} min` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-text-muted">{s.attempts}</td>
                        <td className="py-2">
                          <Badge variant={badge.variant} badgeSize="sm">
                            {badge.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.totalAttempts === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <XCircle size={32} className="mx-auto text-text-muted" />
            <p className="mt-2 text-sm text-text-muted">
              Nenhuma tentativa encontrada para o periodo selecionado.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
