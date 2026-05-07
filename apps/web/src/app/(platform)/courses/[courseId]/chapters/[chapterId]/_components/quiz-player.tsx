"use client"

import { Button } from "@eximia/ui"
import { CheckCircle, ChevronRight, RotateCcw, Trophy, XCircle } from "lucide-react"
import { useCallback, useState } from "react"
import { ConfettiBurst } from "./confetti-burst"

interface QuizQuestion {
  id: string
  text: string
  question_type: "multiple_choice" | "true_false" | "open_ended"
  options: string[] | null
  correct_answer: string | null
  explanation: string | null
  skill: string | null
}

interface QuizPlayerProps {
  questions: QuizQuestion[]
  chapterId: string
  courseId: string
  onComplete?: (score: number, total: number) => void
}

interface QuizAnswer {
  questionId: string
  answer: string
  isCorrect: boolean | null // null for open-ended
}

type QuizState = "answering" | "review" | "results"

export function QuizPlayer({ questions, chapterId, courseId, onComplete }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map())
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [quizState, setQuizState] = useState<QuizState>("answering")
  const [showExplanation, setShowExplanation] = useState(false)

  const scorableQuestions = questions.filter((q) => q.question_type !== "open_ended")
  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers.get(currentQuestion?.id ?? "")
  const isLastQuestion = currentIndex === questions.length - 1
  const progress = ((currentIndex + 1) / questions.length) * 100

  const submitAnswer = useCallback(() => {
    if (!selectedOption || !currentQuestion) return

    const isCorrect =
      currentQuestion.question_type === "open_ended"
        ? null
        : selectedOption === currentQuestion.correct_answer

    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(currentQuestion.id, {
        questionId: currentQuestion.id,
        answer: selectedOption,
        isCorrect,
      })
      return next
    })
    setShowExplanation(true)
  }, [selectedOption, currentQuestion])

  const nextQuestion = useCallback(() => {
    setSelectedOption(null)
    setShowExplanation(false)

    if (isLastQuestion) {
      setQuizState("results")
      const correct = Array.from(answers.values()).filter((a) => a.isCorrect === true).length
      // Count the current answer too if just submitted
      const currentCorrect =
        currentQuestion?.question_type !== "open_ended" &&
        selectedOption === currentQuestion?.correct_answer
          ? 1
          : 0
      onComplete?.(correct + currentCorrect, scorableQuestions.length)
    } else {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [isLastQuestion, answers, currentQuestion, selectedOption, scorableQuestions.length, onComplete])

  const restart = useCallback(() => {
    setCurrentIndex(0)
    setAnswers(new Map())
    setSelectedOption(null)
    setShowExplanation(false)
    setQuizState("answering")
  }, [])

  // Results screen
  if (quizState === "results") {
    const correct = Array.from(answers.values()).filter((a) => a.isCorrect === true).length
    const total = scorableQuestions.length
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0
    const passed = percentage >= 70

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <ConfettiBurst trigger={passed} />
        <div className={`rounded-2xl border p-8 text-center space-y-5 ${
          passed
            ? "bg-gradient-to-b from-semantic-success/5 to-bg-card border-semantic-success/20"
            : "bg-bg-card border-border-subtle"
        }`}>
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${
              passed
                ? "bg-semantic-success/15 ring-1 ring-semantic-success/20"
                : "bg-semantic-warning/10 ring-1 ring-semantic-warning/20"
            }`}
          >
            {passed ? (
              <Trophy size={36} className="text-semantic-success" />
            ) : (
              <RotateCcw size={36} className="text-semantic-warning" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              {passed ? "Excelente!" : "Continue praticando"}
            </h2>
            <p className="mt-1 text-text-secondary">
              {passed
                ? "Você demonstrou domínio do conteúdo. Parabéns pela dedicação!"
                : "Revise o material e tente novamente. Cada tentativa fortalece seu aprendizado."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">{percentage}%</p>
              <p className="text-xs text-text-muted">Acertos</p>
            </div>
            <div className="h-12 w-px bg-border-subtle" />
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">
                {correct}/{total}
              </p>
              <p className="text-xs text-text-muted">Corretas</p>
            </div>
          </div>

          {/* Score bar */}
          <div className="mx-auto max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  passed ? "bg-semantic-success" : "bg-semantic-warning"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">Mínimo: 70%</p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" onClick={restart}>
              <RotateCcw size={14} className="mr-1.5" />
              Tentar Novamente
            </Button>
            <Button onClick={() => setQuizState("review")}>
              Ver Respostas
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const isMultipleChoice = currentQuestion.question_type === "multiple_choice"
  const isTrueFalse = currentQuestion.question_type === "true_false"
  const isOpenEnded = currentQuestion.question_type === "open_ended"
  const options = isMultipleChoice
    ? (currentQuestion.options ?? [])
    : isTrueFalse
      ? ["Verdadeiro", "Falso"]
      : []

  const hasAnswered = showExplanation

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Questão {currentIndex + 1} de {questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div
            className="h-full rounded-full bg-cerrado-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-xl bg-bg-card shadow-card p-6 space-y-5">
        {/* Skill badge */}
        {currentQuestion.skill && (
          <span className="inline-block rounded-full bg-cerrado-600/10 px-3 py-1 text-xs font-medium text-cerrado-600">
            {currentQuestion.skill}
          </span>
        )}

        {/* Question text */}
        <h3 className="text-lg font-semibold text-text-primary leading-relaxed">
          {currentQuestion.text}
        </h3>

        {/* Options */}
        {!isOpenEnded && (
          <div className="space-y-2">
            {options.map((option, idx) => {
              const optionValue = isTrueFalse
                ? option === "Verdadeiro"
                  ? "true"
                  : "false"
                : option
              const isSelected = selectedOption === optionValue
              const isCorrectOption = optionValue === currentQuestion.correct_answer
              const letter = String.fromCharCode(65 + idx) // A, B, C, D

              let borderClass = "border-border-subtle hover:border-cerrado-600/40"
              let bgClass = "bg-transparent"
              let iconEl: React.ReactNode = null

              if (hasAnswered) {
                if (isCorrectOption) {
                  borderClass = "border-semantic-success"
                  bgClass = "bg-semantic-success/5"
                  iconEl = <CheckCircle size={18} className="text-semantic-success shrink-0" />
                } else if (isSelected && !isCorrectOption) {
                  borderClass = "border-semantic-error"
                  bgClass = "bg-semantic-error/5"
                  iconEl = <XCircle size={18} className="text-semantic-error shrink-0" />
                }
              } else if (isSelected) {
                borderClass = "border-cerrado-600 ring-1 ring-cerrado-600/20"
                bgClass = "bg-cerrado-600/5"
              }

              return (
                <button
                  key={optionValue}
                  type="button"
                  onClick={() => !hasAnswered && setSelectedOption(optionValue)}
                  disabled={hasAnswered}
                  className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all ${borderClass} ${bgClass} ${
                    hasAnswered ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isSelected && !hasAnswered
                        ? "bg-cerrado-600 text-white"
                        : hasAnswered && isCorrectOption
                          ? "bg-semantic-success text-white"
                          : hasAnswered && isSelected && !isCorrectOption
                            ? "bg-semantic-error text-white"
                            : "bg-bg-elevated text-text-muted"
                    }`}
                  >
                    {isTrueFalse ? (option === "Verdadeiro" ? "V" : "F") : letter}
                  </span>
                  <span className="flex-1 text-sm text-text-primary">{option}</span>
                  {iconEl}
                </button>
              )
            })}
          </div>
        )}

        {/* Open-ended textarea */}
        {isOpenEnded && (
          <textarea
            value={selectedOption ?? ""}
            onChange={(e) => setSelectedOption(e.target.value)}
            disabled={hasAnswered}
            rows={5}
            className="w-full rounded-lg shadow-card bg-bg-primary p-4 text-sm text-text-primary placeholder:text-text-muted focus:border-cerrado-600 focus:outline-none focus:ring-1 focus:ring-cerrado-600/20 resize-y"
            placeholder="Escreva sua resposta..."
          />
        )}

        {/* Explanation (after answering) */}
        {hasAnswered && currentQuestion.explanation && (
          <div className="rounded-lg bg-cerrado-600/5 border border-cerrado-600/20 p-4">
            <p className="text-xs font-medium text-cerrado-600 mb-1">Explicação</p>
            <p className="text-sm text-text-secondary">{currentQuestion.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {!hasAnswered ? (
            <Button
              onClick={submitAnswer}
              disabled={!selectedOption}
            >
              Confirmar Resposta
            </Button>
          ) : (
            <Button onClick={nextQuestion}>
              {isLastQuestion ? "Ver Resultado" : "Próxima"}
              <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
