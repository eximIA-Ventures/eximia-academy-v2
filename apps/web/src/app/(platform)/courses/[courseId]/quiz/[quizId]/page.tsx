"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Clock, FileQuestion, Play, Target, Trophy } from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { QuizPlayer } from "@/components/quiz/quiz-player"
import { QuizResult } from "@/components/quiz/quiz-result"
import {
  getQuizQuestions,
  getQuizSession,
  getRemediationChapters,
  getStudentAttempts,
  startQuizAttempt,
} from "./actions"

interface PageProps {
  params: Promise<{ courseId: string; quizId: string }>
}

type Phase = "loading" | "start" | "playing" | "result" | "max_reached"

interface QuizData {
  id: string
  title: string
  quiz_type: string
  time_limit_minutes: number | null
  passing_score: number
  max_attempts: number
  shuffle_questions: boolean
  show_answers_after: string
  question_ids: string[]
  is_active: boolean
  course_id: string
}

interface AttemptData {
  id: string
  status: string
  score: number | null
  total_questions: number
  correct_answers: number
  feedback: FeedbackItem[] | null
}

interface FeedbackItem {
  questionId: string
  correct: boolean | null
  studentAnswer: string
  correctAnswer: string | null
  explanation: string | null
}

interface QuestionData {
  id: string
  text: string
  skill: string | null
  question_type: string
  options: string[] | null
}

export default function QuizPage({ params }: PageProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [attempts, setAttempts] = useState<AttemptData[]>([])
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<AttemptData | null>(null)
  const [chapterSuggestions, setChapterSuggestions] = useState<
    Array<{ chapterId: string; chapterTitle: string; errorCount: number }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load quiz data
  useEffect(() => {
    params.then(({ quizId }) => {
      Promise.all([getQuizSession(quizId), getStudentAttempts(quizId)]).then(
        ([quizRes, attemptsRes]) => {
          if (quizRes.error || !quizRes.data) {
            setError(quizRes.error ?? "Quiz não encontrado")
            return
          }
          setQuiz(quizRes.data as QuizData)
          setAttempts((attemptsRes.data as AttemptData[]) ?? [])

          const completedAttempts = (attemptsRes.data as AttemptData[])?.filter(
            (a) => a.status !== "in_progress",
          )
          if (
            completedAttempts &&
            completedAttempts.length >= (quizRes.data as QuizData).max_attempts
          ) {
            setLastResult(completedAttempts[0] ?? null)
            setPhase("max_reached")
          } else {
            setPhase("start")
          }
        },
      )
    })
  }, [params])

  const handleStart = useCallback(() => {
    if (!quiz) return
    setError(null)
    startTransition(async () => {
      const { quizId } = await params
      const result = await startQuizAttempt(quizId)
      if (result.error) {
        setError(result.error)
        return
      }

      setCurrentAttemptId(result.data!.id)
      setStartedAt(result.data!.started_at)

      // Load questions
      const qResult = await getQuizQuestions(quiz.question_ids)
      if (qResult.data) setQuestions(qResult.data)
      setPhase("playing")
    })
  }, [quiz, params, startTransition])

  const handleComplete = useCallback(
    (status: string) => {
      // Refresh attempts and load remediation if failed
      params.then(async ({ quizId }) => {
        const res = await getStudentAttempts(quizId)
        setAttempts((res.data as AttemptData[]) ?? [])
        const latest = (res.data as AttemptData[])?.[0]
        if (latest) {
          setLastResult(latest)
          // Load remediation chapters for failed attempts
          if (
            latest.status === "failed" &&
            latest.feedback &&
            quiz?.question_ids
          ) {
            const remRes = await getRemediationChapters(quiz.question_ids, latest.feedback)
            setChapterSuggestions(remRes.data ?? [])
          }
        }
        setPhase("result")
      })
    },
    [params, quiz],
  )

  const handleRetry = useCallback(() => {
    setPhase("start")
    setCurrentAttemptId(null)
    setLastResult(null)
  }, [])

  if (phase === "loading") {
    return <p className="py-12 text-center text-sm text-text-muted">Carregando quiz...</p>
  }

  if (error && !quiz) {
    return (
      <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
        {error}
      </div>
    )
  }

  if (!quiz) return null

  const typeConfig = {
    practice: { label: "Pratica", variant: "info" as const },
    exam: { label: "Exame", variant: "error" as const },
    diagnostic: { label: "Diagnostico", variant: "warning" as const },
  }
  const cfg = typeConfig[quiz.quiz_type as keyof typeof typeConfig] ?? typeConfig.practice
  const completedAttempts = attempts.filter((a) => a.status !== "in_progress")

  // Start screen
  if (phase === "start") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{quiz.title}</CardTitle>
            <Badge variant={cfg.variant} badgeSize="sm" className="mx-auto mt-2">
              {cfg.label}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-md bg-bg-surface p-3">
                <FileQuestion size={20} className="mx-auto text-text-muted" />
                <p className="mt-1 text-sm font-medium text-text-primary">
                  {quiz.question_ids?.length ?? 0} questões
                </p>
              </div>
              {quiz.time_limit_minutes && (
                <div className="rounded-md bg-bg-surface p-3">
                  <Clock size={20} className="mx-auto text-text-muted" />
                  <p className="mt-1 text-sm font-medium text-text-primary">
                    {quiz.time_limit_minutes} minutos
                  </p>
                </div>
              )}
              <div className="rounded-md bg-bg-surface p-3">
                <Target size={20} className="mx-auto text-text-muted" />
                <p className="mt-1 text-sm font-medium text-text-primary">
                  Nota minima: {quiz.passing_score}%
                </p>
              </div>
              <div className="rounded-md bg-bg-surface p-3">
                <Trophy size={20} className="mx-auto text-text-muted" />
                <p className="mt-1 text-sm font-medium text-text-primary">
                  Tentativa {completedAttempts.length + 1}/{quiz.max_attempts}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
                {error}
              </div>
            )}

            <Button onClick={handleStart} disabled={isPending} className="w-full">
              <Play size={14} className="mr-1" />
              {isPending ? "Iniciando..." : "Iniciar Quiz"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Playing screen
  if (phase === "playing" && currentAttemptId && startedAt) {
    return (
      <QuizPlayer
        attemptId={currentAttemptId}
        questions={questions}
        timeLimitMinutes={quiz.time_limit_minutes}
        startedAt={startedAt}
        shuffleQuestions={quiz.shuffle_questions}
        onComplete={handleComplete}
      />
    )
  }

  // Result / max reached screen
  if ((phase === "result" || phase === "max_reached") && lastResult) {
    const questionTextsMap = new Map(questions.map((q) => [q.id, q.text]))
    return (
      <QuizResult
        score={lastResult.score}
        totalQuestions={lastResult.total_questions}
        correctAnswers={lastResult.correct_answers}
        status={lastResult.status}
        passingScore={quiz.passing_score}
        showAnswers={quiz.show_answers_after !== "never"}
        attemptsUsed={completedAttempts.length}
        maxAttempts={quiz.max_attempts}
        feedback={lastResult.feedback ?? undefined}
        questionTexts={questionTextsMap.size > 0 ? questionTextsMap : undefined}
        courseId={quiz.course_id}
        chapterSuggestions={chapterSuggestions.length > 0 ? chapterSuggestions : undefined}
        onRetry={completedAttempts.length < quiz.max_attempts ? handleRetry : undefined}
      />
    )
  }

  return null
}
