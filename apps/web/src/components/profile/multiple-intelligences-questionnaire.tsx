"use client"

import { saveAssessmentProgress, saveAssessmentResult } from "@/app/(platform)/perfil/actions"
import { Button, ProgressBar } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type MultipleIntelligencesResult, MULTIPLE_INTELLIGENCES_ITEMS, scoreMultipleIntelligences } from "./scoring"

const LIKERT_LABELS = [
  "Discordo totalmente",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo totalmente",
]

interface MultipleIntelligencesQuestionnaireProps {
  userId?: string
  savedProgress?: { answers: Record<string, number> }
  onComplete: (result: MultipleIntelligencesResult) => void
  onBack: () => void
}

export function MultipleIntelligencesQuestionnaire({
  savedProgress, onComplete, onBack,
}: MultipleIntelligencesQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    if (!savedProgress?.answers) return {}
    const restored: Record<number, number> = {}
    for (const [key, val] of Object.entries(savedProgress.answers)) {
      restored[Number(key)] = val
    }
    return restored
  })
  const answerCountRef = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const totalItems = MULTIPLE_INTELLIGENCES_ITEMS.length
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / totalItems) * 100
  const isComplete = answeredCount === totalItems

  const saveProgress = useCallback(async () => {
    const stringAnswers: Record<string, number> = {}
    for (const [key, val] of Object.entries(answers)) {
      stringAnswers[String(key)] = val
    }
    await saveAssessmentProgress({
      type: "multiple_intelligences",
      progress: { answers: stringAnswers, completed: false as const },
    })
  }, [answers])

  const handleAnswer = useCallback((itemId: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }))
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
      const result = scoreMultipleIntelligences(answers)
      const saveResult = await saveAssessmentResult({ type: "multiple_intelligences", result })
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
        <h2 className="text-xl font-bold text-text-primary">Inteligências Múltiplas</h2>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
          <span>{answeredCount} de {totalItems} respondidas</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      <p className="mb-6 text-sm text-text-secondary">
        Para cada afirmacao, indique o quanto ela descreve você.
      </p>

      <div className="space-y-6">
        {MULTIPLE_INTELLIGENCES_ITEMS.map((item) => (
          <div key={item.id} className="rounded-lg border border-border-medium bg-bg-card p-4">
            <p className="mb-3 text-sm font-medium text-text-primary">
              {item.id}. {item.text}
            </p>
            <div className="flex flex-wrap gap-2">
              {LIKERT_LABELS.map((label, index) => {
                const value = index + 1
                const isSelected = answers[item.id] === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleAnswer(item.id, value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-mid ${
                      isSelected
                        ? "bg-accent-blue-mid text-white"
                        : "bg-bg-surface text-text-secondary hover:bg-bg-surface/80"
                    }`}
                  >
                    {label}
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
