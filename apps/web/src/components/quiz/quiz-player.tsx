"use client"

import { Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { ArrowLeft, ArrowRight, Send } from "lucide-react"
import { useCallback, useMemo, useState, useTransition } from "react"
import { submitQuizAttempt } from "@/app/(platform)/courses/[courseId]/quiz/[quizId]/actions"
import { QuizTimer } from "./quiz-timer"

/* --------------------------------- Types --------------------------------- */

interface Question {
  id: string
  text: string
  skill: string | null
  question_type: string
  options: string[] | null
}

interface QuizPlayerProps {
  attemptId: string
  questions: Question[]
  timeLimitMinutes: number | null
  startedAt: string
  shuffleQuestions: boolean
  onComplete: (status: string) => void
}

/* -------------------------------- Helpers -------------------------------- */

function shuffleArray<T>(arr: T[], seed: string): T[] {
  const shuffled = [...arr]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) | 0
    const j = Math.abs(hash) % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/* ------------------------------- Component ------------------------------- */

export function QuizPlayer({
  attemptId,
  questions: rawQuestions,
  timeLimitMinutes,
  startedAt,
  shuffleQuestions,
  onComplete,
}: QuizPlayerProps) {
  const [isPending, startTransition] = useTransition()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const questions = useMemo(
    () => (shuffleQuestions ? shuffleArray(rawQuestions, attemptId) : rawQuestions),
    [rawQuestions, shuffleQuestions, attemptId],
  )

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const answeredCount = answers.size

  const handleAnswer = useCallback(
    (answer: string) => {
      setAnswers((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, answer)
        return next
      })
    },
    [currentQuestion],
  )

  const handleSubmit = useCallback(() => {
    setError(null)
    const answerArray = questions.map((q) => ({
      questionId: q.id,
      answer: answers.get(q.id) ?? "",
    }))

    startTransition(async () => {
      const result = await submitQuizAttempt(attemptId, answerArray)
      if (result.error) {
        setError(result.error)
        return
      }
      onComplete(result.data?.status ?? "completed")
    })
  }, [attemptId, questions, answers, onComplete, startTransition])

  const handleTimeUp = useCallback(() => {
    handleSubmit()
  }, [handleSubmit])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header with timer and progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary" aria-live="polite" aria-atomic="true">
          Questão {currentIndex + 1} de {totalQuestions} ({answeredCount} respondidas)
        </span>
        {timeLimitMinutes && (
          <QuizTimer
            timeLimitMinutes={timeLimitMinutes}
            startedAt={startedAt}
            onTimeUp={handleTimeUp}
          />
        )}
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full rounded-full bg-bg-surface"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalQuestions}
        aria-label={`Progresso: questão ${currentIndex + 1} de ${totalQuestions}`}
      >
        <div
          className="h-full rounded-full bg-accent-blue-mid transition-all"
          style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {error && (
        <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
          {error}
        </div>
      )}

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{currentQuestion.text}</CardTitle>
          {currentQuestion.skill && (
            <p className="text-xs text-text-muted">{currentQuestion.skill}</p>
          )}
        </CardHeader>
        <CardContent>
          {currentQuestion.question_type === "multiple_choice" &&
          currentQuestion.options?.length ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const optionKey = `option_${String.fromCharCode(97 + idx)}`
                const isSelected = answers.get(currentQuestion.id) === optionKey
                return (
                  <button
                    key={optionKey}
                    type="button"
                    onClick={() => handleAnswer(optionKey)}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-accent-blue-mid bg-accent-blue-mid/10 text-text-primary"
                        : "border-border bg-bg-card text-text-secondary hover:border-accent-blue-mid/50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                        isSelected
                          ? "border-accent-blue-mid bg-accent-blue-mid text-white"
                          : "border-border text-text-muted"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>
          ) : currentQuestion.question_type === "true_false" ? (
            <div className="flex gap-3">
              {[
                { value: "true", label: "Verdadeiro" },
                { value: "false", label: "Falso" },
              ].map(({ value, label }) => {
                const isSelected = answers.get(currentQuestion.id) === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleAnswer(value)}
                    className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-accent-blue-mid bg-accent-blue-mid/10 text-text-primary"
                        : "border-border bg-bg-card text-text-secondary hover:border-accent-blue-mid/50"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : (
            <textarea
              value={answers.get(currentQuestion.id) ?? ""}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Escreva sua resposta aqui..."
              rows={4}
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue-mid focus:outline-none"
            />
          )}
        </CardContent>
      </Card>

      {/* Question navigation grid */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors ${
              i === currentIndex
                ? "bg-accent-blue-mid text-white"
                : answers.has(q.id)
                  ? "bg-accent-blue-mid/20 text-accent-blue-mid"
                  : "bg-bg-surface text-text-muted hover:bg-bg-surface/80"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <ArrowLeft size={14} className="mr-1" />
          Anterior
        </Button>

        <div className="flex gap-2">
          {currentIndex < totalQuestions - 1 ? (
            <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
              Proximo
              <ArrowRight size={14} className="ml-1" />
            </Button>
          ) : null}
          <Button
            onClick={handleSubmit}
            disabled={isPending || answeredCount === 0}
            variant={currentIndex === totalQuestions - 1 ? "default" : "outline"}
          >
            {isPending ? "Enviando..." : "Enviar Quiz"}
            <Send size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
