"use client"

import { CareerAnchorsQuestionnaire } from "@/components/profile/career-anchors-questionnaire"
import { CareerAnchorsResults } from "@/components/profile/career-anchors-results"
import type { CareerAnchorsResult } from "@/components/profile/scoring"
import { Button } from "@eximia/ui"
import { ArrowLeft, Clock, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"

interface CareerAnchorsWizardClientProps {
  userId: string
  onCooldown: boolean
  remainingDays: number
  previousResult: {
    technical: number
    management: number
    autonomy: number
    security: number
    entrepreneurship: number
    service: number
    challenge: number
    lifestyle: number
    top3: string[]
  } | null
}

type WizardPhase = "quiz" | "results"

export function CareerAnchorsWizardClient({
  userId,
  onCooldown,
  remainingDays,
  previousResult,
}: CareerAnchorsWizardClientProps) {
  const [phase, setPhase] = useState<WizardPhase>(() => {
    if (onCooldown && previousResult) return "results"
    if (previousResult) return "results"
    return "quiz"
  })
  const [result, setResult] = useState<CareerAnchorsResult | null>(previousResult)

  const handleComplete = useCallback((scoredResult: CareerAnchorsResult) => {
    // The questionnaire component already saves via saveAssessmentResult
    setResult(scoredResult)
    setPhase("results")
  }, [])

  const handleRetake = useCallback(() => {
    setResult(null)
    setPhase("quiz")
  }, [])

  // ─── Results View ─────────────────────────────────────────────────────
  if (phase === "results" && result) {
    return (
      <div className="space-y-6">
        {onCooldown && remainingDays > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-accent-gold/30 bg-accent-gold/5 px-4 py-3">
            <Clock className="h-4 w-4 text-accent-gold" />
            <p className="text-sm text-text-secondary">
              Voce podera refazer este assessment em {remainingDays} dia{remainingDays > 1 ? "s" : ""}.
            </p>
          </div>
        )}

        <CareerAnchorsResults result={result} onBack={() => {}} />

        <div className="flex items-center justify-between">
          <Link
            href="/perfil"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Perfil
          </Link>
          {!onCooldown && (
            <Button variant="ghost" size="sm" onClick={handleRetake}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Refazer Assessment
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─── Quiz View ────────────────────────────────────────────────────────
  return (
    <CareerAnchorsQuestionnaire
      userId={userId}
      onComplete={handleComplete}
      onBack={() => {}}
      savedProgress={undefined}
    />
  )
}
