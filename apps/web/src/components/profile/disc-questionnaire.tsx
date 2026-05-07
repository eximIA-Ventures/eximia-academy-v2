"use client"

import { saveAssessmentProgress, saveAssessmentResult } from "@/app/(platform)/perfil/actions"
import { Button, ProgressBar } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type DISCResult, DISC_ITEMS, scoreDISC } from "./scoring"

interface DISCQuestionnaireProps {
  userId?: string
  savedProgress?: { answers: Record<string, string> }
  onComplete: (result: DISCResult) => void
  onBack: () => void
}

export function DISCQuestionnaire({ savedProgress, onComplete, onBack }: DISCQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<number, "a" | "b">>(() => {
    if (!savedProgress?.answers) return {}
    const restored: Record<number, "a" | "b"> = {}
    for (const [key, val] of Object.entries(savedProgress.answers)) {
      if (val === "a" || val === "b") restored[Number(key)] = val
    }
    return restored
  })
  const answerCountRef = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const answeredCount = Object.keys(answers).length
  const totalItems = DISC_ITEMS.length
  const progress = (answeredCount / totalItems) * 100
  const isComplete = answeredCount === totalItems

  const saveProgress = useCallback(async () => {
    const stringAnswers: Record<string, number> = {}
    for (const [key, val] of Object.entries(answers)) {
      stringAnswers[String(key)] = val === "a" ? 1 : 2
    }
    await saveAssessmentProgress({
      type: "disc",
      progress: { answers: stringAnswers, completed: false as const },
    })
  }, [answers])

  const handleAnswer = useCallback((itemId: number, choice: "a" | "b") => {
    setAnswers((prev) => ({ ...prev, [itemId]: choice }))
    answerCountRef.current++
  }, [])

  useEffect(() => {
    if (answerCountRef.current > 0 && answerCountRef.current % 5 === 0) {
      saveProgress()
    }
  }, [answeredCount, saveProgress])

  useEffect(() => {
    const handler = () => { saveProgress() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [saveProgress])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = scoreDISC(answers)
      const saveResult = await saveAssessmentResult({ type: "disc", result })
      if (saveResult.error) {
        setSubmitError(saveResult.error)
        return
      }
      onComplete(result)
    } catch {
      setSubmitError("Erro ao salvar resultado. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">DISC</h2>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
          <span>{answeredCount} de {totalItems} respondidas</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      <p className="mb-6 text-sm text-text-secondary">
        Para cada par de afirmacoes, escolha a que mais descreve você.
      </p>

      <div className="space-y-4">
        {DISC_ITEMS.map((item) => (
          <div key={item.id} className="rounded-lg shadow-card bg-bg-card p-4">
            <p className="mb-3 text-xs font-medium text-text-muted">Questao {item.id}</p>
            <div className="flex flex-col gap-2">
              {(["a", "b"] as const).map((choice) => {
                const option = item[choice]
                const isSelected = answers[item.id] === choice
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleAnswer(item.id, choice)}
                    className={`w-full rounded-md px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 ${
                      isSelected
                        ? "bg-cerrado-600 text-white"
                        : "bg-bg-surface text-text-secondary hover:bg-bg-surface/80"
                    }`}
                  >
                    {option.text}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {submitError && (
        <div className="mt-4 rounded-md border border-semantic-error/20 bg-semantic-error/5 px-4 py-3">
          <p className="text-sm text-semantic-error">{submitError}</p>
        </div>
      )}

      {isComplete && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Salvando..." : "Ver Resultado"}
          </Button>
        </div>
      )}
    </div>
  )
}
