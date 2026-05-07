"use client"

import { saveAssessmentProgress, saveAssessmentResult } from "@/app/(platform)/perfil/actions"
import { Button, ProgressBar } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type BigFiveResult, IPIP_NEO_20_ITEMS, scoreBigFive } from "./scoring"

export type { BigFiveResult }
export { scoreBigFive }

const LIKERT_LABELS = [
  "Discordo totalmente",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo totalmente",
]

interface BigFiveQuestionnaireProps {
  userId: string
  savedProgress?: { answers: Record<string, number> }
  onComplete: (result: BigFiveResult) => void
  onBack: () => void
}

export function BigFiveQuestionnaire({ userId, savedProgress, onComplete, onBack }: BigFiveQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    if (!savedProgress?.answers) return {}
    const restored: Record<number, number> = {}
    for (const [key, val] of Object.entries(savedProgress.answers)) {
      restored[Number(key)] = val
    }
    return restored
  })
  const answerCountRef = useRef(0)

  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / 20) * 100
  const isComplete = answeredCount === 20

  const saveProgress = useCallback(async () => {
    const stringAnswers: Record<string, number> = {}
    for (const [key, val] of Object.entries(answers)) {
      stringAnswers[String(key)] = val
    }
    await saveAssessmentProgress({
      type: "big_five",
      progress: { answers: stringAnswers, completed: false as const },
    })
  }, [answers])

  const handleAnswer = useCallback((itemId: number, value: number) => {
    setAnswers((prev) => {
      const updated = { ...prev, [itemId]: value }
      return updated
    })
    answerCountRef.current++
  }, [])

  // Auto-save every 5 answers
  useEffect(() => {
    if (answerCountRef.current > 0 && answerCountRef.current % 5 === 0) {
      saveProgress()
    }
  }, [answeredCount, saveProgress])

  // Save on page exit
  useEffect(() => {
    const handler = () => { saveProgress() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [saveProgress])

  const handleSubmit = async () => {
    const result = scoreBigFive(answers)
    await saveAssessmentResult({ type: "big_five", result })
    onComplete(result)
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Big Five (OCEAN)</h2>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
          <span>{answeredCount} de 20 respondidas</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      <p className="mb-6 text-sm text-text-secondary">
        Para cada afirmacao, indique o quanto ela descreve você.
      </p>

      <div className="space-y-6">
        {IPIP_NEO_20_ITEMS.map((item) => (
          <div key={item.id} className="rounded-lg shadow-card bg-bg-card p-4">
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
                    onClick={() => handleAnswer(item.id, value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-cerrado-600 text-white"
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

      {isComplete && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit}>Ver Resultado</Button>
        </div>
      )}
    </div>
  )
}
