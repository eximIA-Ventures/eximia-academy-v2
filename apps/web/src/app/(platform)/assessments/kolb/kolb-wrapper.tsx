"use client"

import { Button } from "@eximia/ui"
import { KolbQuestionnaire } from "@/components/profile/kolb-questionnaire"
import { KolbResults } from "@/components/profile/kolb-results"
import type { KolbResult } from "@/lib/assessments/kolb-scoring"
import type { KolbMode } from "@/lib/assessments/kolb-items"
import { Clock, RotateCcw } from "lucide-react"
import { useState } from "react"
import { submitKolbAssessment } from "./actions"

interface KolbAssessmentWrapperProps {
  previousResult: KolbResult | null
  onCooldown: boolean
  remainingDays: number
  userId: string
}

export function KolbAssessmentWrapper({
  previousResult,
  onCooldown,
  remainingDays,
}: KolbAssessmentWrapperProps) {
  const [result, setResult] = useState<KolbResult | null>(previousResult)
  const [phase, setPhase] = useState<"quiz" | "results">(previousResult ? "results" : "quiz")

  async function handleComplete(scoredResult: KolbResult, rawAnswers: Record<number, Record<KolbMode, number>>) {
    const response = await submitKolbAssessment(rawAnswers)
    setResult(response.result ?? scoredResult)
    setPhase("results")
  }

  if (onCooldown && previousResult) {
    return (
      <div className="space-y-6">
        <KolbResults result={previousResult} />
        <div className="mx-auto max-w-2xl rounded-xl bg-bg-card ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
          <Clock size={16} className="text-text-muted" />
          <p className="text-sm text-text-muted">
            Você poderá refazer em <strong>{remainingDays} dias</strong>.
          </p>
        </div>
      </div>
    )
  }

  if (phase === "results" && result) {
    return (
      <div className="space-y-6">
        <KolbResults result={result} />
        {!onCooldown && (
          <div className="mx-auto max-w-2xl flex justify-center">
            <Button variant="outline" onClick={() => { setPhase("quiz"); setResult(null) }}>
              <RotateCcw size={14} className="mr-1.5" />
              Refazer Avaliação
            </Button>
          </div>
        )}
      </div>
    )
  }

  return <KolbQuestionnaire onComplete={handleComplete} />
}
