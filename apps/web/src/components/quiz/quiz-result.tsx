"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { CheckCircle, Clock, HelpCircle, MessageSquare, RotateCcw, XCircle } from "lucide-react"
import { RemediationSuggestion } from "./remediation-suggestion"

interface FeedbackItem {
  questionId: string
  correct: boolean | null
  studentAnswer: string
  correctAnswer: string | null
  explanation: string | null
}

interface ChapterSuggestion {
  chapterId: string
  chapterTitle: string
  errorCount: number
}

interface QuizResultProps {
  score: number | null
  totalQuestions: number
  correctAnswers: number
  status: string
  passingScore: number
  showAnswers: boolean
  attemptsUsed: number
  maxAttempts: number
  feedback?: FeedbackItem[]
  questionTexts?: Map<string, string>
  courseId?: string
  chapterSuggestions?: ChapterSuggestion[]
  onRetry?: () => void
}

export function QuizResult({
  score,
  totalQuestions,
  correctAnswers,
  status,
  passingScore,
  showAnswers,
  attemptsUsed,
  maxAttempts,
  feedback,
  questionTexts,
  courseId,
  chapterSuggestions,
  onRetry,
}: QuizResultProps) {
  const passed = score !== null && score >= passingScore
  const canRetry = attemptsUsed < maxAttempts
  const isTimedOut = status === "timed_out"
  const isPendingReview = status === "pending_review"

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader className="text-center">
          {isPendingReview ? (
            <Clock size={48} className="mx-auto text-cerrado-600" />
          ) : passed ? (
            <CheckCircle size={48} className="mx-auto text-semantic-success" />
          ) : (
            <XCircle size={48} className="mx-auto text-semantic-error" />
          )}
          <CardTitle className="mt-4 text-xl">
            {isPendingReview
              ? "Aguardando Revisao"
              : isTimedOut
                ? "Tempo Esgotado"
                : passed
                  ? "Aprovado!"
                  : "Reprovado"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-text-primary">
                {score !== null ? `${Math.round(score)}%` : "—"}
              </p>
              <p className="text-xs text-text-muted">Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-text-primary">
                {correctAnswers}/{totalQuestions}
              </p>
              <p className="text-xs text-text-muted">Corretas</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant={passed ? "success" : "error"} badgeSize="sm">
              Nota minima: {passingScore}%
            </Badge>
            <Badge variant="default" badgeSize="sm">
              Tentativa {attemptsUsed}/{maxAttempts}
            </Badge>
            {isTimedOut && (
              <Badge variant="warning" badgeSize="sm">
                Tempo esgotado
              </Badge>
            )}
            {isPendingReview && (
              <Badge variant="info" badgeSize="sm">
                Revisão pendente
              </Badge>
            )}
          </div>

          {!showAnswers && (
            <p className="text-center text-sm text-text-muted">
              As respostas detalhadas nao estao disponiveis para este quiz.
            </p>
          )}

          {canRetry && onRetry && (
            <div className="flex justify-center pt-2">
              <Button onClick={onRetry} variant="outline">
                <RotateCcw size={14} className="mr-1" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {!canRetry && (
            <div className="space-y-2 text-center">
              <p className="text-sm text-text-muted">Limite de tentativas atingido.</p>
              {!passed && (
                <p className="flex items-center justify-center gap-1 text-xs text-text-muted">
                  <MessageSquare size={12} />
                  Contacte seu instrutor para orientacao.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remediation suggestions for failed attempts */}
      {!passed && !isPendingReview && courseId && chapterSuggestions && chapterSuggestions.length > 0 && (
        <RemediationSuggestion courseId={courseId} chapters={chapterSuggestions} />
      )}

      {/* Detailed feedback per question */}
      {showAnswers && feedback && feedback.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Detalhes por Questao</h3>
          {feedback.map((item, idx) => (
            <Card key={item.questionId}>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start gap-2">
                  {item.correct === true ? (
                    <CheckCircle size={16} className="mt-0.5 shrink-0 text-semantic-success" />
                  ) : item.correct === false ? (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-semantic-error" />
                  ) : (
                    <HelpCircle size={16} className="mt-0.5 shrink-0 text-cerrado-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      Questao {idx + 1}
                      {questionTexts?.get(item.questionId)
                        ? `: ${questionTexts.get(item.questionId)}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Sua resposta:{" "}
                      <span className="whitespace-pre-wrap text-text-secondary">
                        {item.studentAnswer || "(sem resposta)"}
                      </span>
                    </p>
                    {item.correctAnswer && (
                      <p className="text-xs text-text-muted">
                        Resposta correta:{" "}
                        <span className="font-medium text-semantic-success">
                          {item.correctAnswer}
                        </span>
                      </p>
                    )}
                    {item.explanation && (
                      <p className="mt-1 rounded bg-bg-surface px-2 py-1 text-xs text-text-secondary">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
