"use client"

import {
  BIG_FIVE_DIMENSION_LABELS,
  BIG_FIVE_ITEMS,
  type BigFiveDimension,
} from "@/lib/assessments/big-five-items"
import type { BigFiveScores } from "@/lib/assessments/big-five-scoring"
import { getDimensionDescription } from "@/lib/assessments/big-five-scoring"
import { Button, Card, CardContent, ProgressBar } from "@eximia/ui"
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Clock } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts"

import { submitBigFiveAssessment } from "./actions"

// ─── Types ───────────────────────────────────────────────────────────────

interface BigFiveWizardClientProps {
  isOnCooldown: boolean
  daysRemaining: number
  previousResult: Record<string, number> | null
}

interface ShuffledItem {
  originalId: number
  text: string
}

const LIKERT_OPTIONS = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
] as const

const TOTAL_QUESTIONS = 44

// ─── Shuffle utility ────────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled
}

// ─── Component ──────────────────────────────────────────────────────────

export function BigFiveWizardClient({
  isOnCooldown,
  daysRemaining,
  previousResult,
}: BigFiveWizardClientProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [responses, setResponses] = useState<Record<number, number>>({})
  const [showResult, setShowResult] = useState(false)
  const [scores, setScores] = useState<BigFiveScores | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Shuffle items on mount while preserving dimension mapping via originalId
  const shuffledItems = useMemo<ShuffledItem[]>(() => {
    return shuffleArray(
      BIG_FIVE_ITEMS.map((item) => ({
        originalId: item.id,
        text: item.text,
      })),
    )
  }, [])

  const currentItem = shuffledItems[currentQuestion]
  const progress = Math.round(
    ((currentQuestion + (responses[currentItem?.originalId] ? 1 : 0)) / TOTAL_QUESTIONS) * 100,
  )
  const allAnswered = Object.keys(responses).length === TOTAL_QUESTIONS

  // If on cooldown and has previous result, show it directly
  useEffect(() => {
    if (isOnCooldown && previousResult) {
      setScores(previousResult as unknown as BigFiveScores)
      setShowResult(true)
    }
  }, [isOnCooldown, previousResult])

  const handleSelectAnswer = useCallback(
    (value: number) => {
      if (!currentItem) return
      setResponses((prev) => ({ ...prev, [currentItem.originalId]: value }))
      // Auto-advance to next question after a short delay
      if (currentQuestion < TOTAL_QUESTIONS - 1) {
        setTimeout(() => setCurrentQuestion((prev) => prev + 1), 200)
      }
    },
    [currentItem, currentQuestion],
  )

  const handleNext = useCallback(() => {
    if (currentQuestion < TOTAL_QUESTIONS - 1) {
      setCurrentQuestion((prev) => prev + 1)
    }
  }, [currentQuestion])

  const handlePrevious = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1)
    }
  }, [currentQuestion])

  const handleSubmit = useCallback(() => {
    setError(null)

    // Build ordered responses array (by item id 1-44)
    const orderedResponses: number[] = []
    for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
      const answer = responses[i]
      if (answer === undefined) {
        setError("Responda todas as perguntas antes de enviar.")
        return
      }
      orderedResponses.push(answer)
    }

    startTransition(async () => {
      const result = await submitBigFiveAssessment(orderedResponses)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.scores) {
        setScores(result.scores)
        setShowResult(true)
      }
    })
  }, [responses])

  // ─── Cooldown screen ──────────────────────────────────────────────────

  if (isOnCooldown && !previousResult) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-text-secondary" />
          <h2 className="mb-2 text-xl font-bold text-text-primary">
            Assessment em periodo de espera
          </h2>
          <p className="text-text-secondary">
            Você completou o Big Five recentemente. Aguarde{" "}
            <span className="font-semibold text-cerrado-600">
              {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}
            </span>{" "}
            para refaze-lo.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ─── Results screen ───────────────────────────────────────────────────

  if (showResult && scores) {
    return <BigFiveResultView scores={scores} isFromCooldown={isOnCooldown} />
  }

  // ─── Question wizard ──────────────────────────────────────────────────

  if (!currentItem) return null

  const selectedValue = responses[currentItem.originalId]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Big Five — Personalidade</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Avalie cada afirmacao de acordo com o quanto ela descreve você.
        </p>
      </div>

      {/* Progress */}
      <ProgressBar
        value={Object.keys(responses).length}
        max={TOTAL_QUESTIONS}
        label={`Pergunta ${currentQuestion + 1} de ${TOTAL_QUESTIONS}`}
        showValue
        size="md"
      />

      {/* Question Card */}
      <Card>
        <CardContent className="p-6">
          <p className="mb-6 text-lg font-medium text-text-primary">{currentItem.text}</p>

          <div className="space-y-3" role="radiogroup" aria-label="Selecione sua resposta">
            {LIKERT_OPTIONS.map((option) => {
              const isSelected = selectedValue === option.value
              const inputId = `likert-option-${option.value}`
              return (
                <label
                  key={option.value}
                  htmlFor={inputId}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-cerrado-600 bg-cerrado-600/10"
                      : "border-border-medium hover:border-cerrado-600/50"
                  }`}
                >
                  <input
                    type="radio"
                    id={inputId}
                    name={`question-${currentItem.originalId}`}
                    value={option.value}
                    checked={isSelected}
                    onChange={() => handleSelectAnswer(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? "border-cerrado-600" : "border-text-secondary"
                    }`}
                  >
                    {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-cerrado-600" />}
                  </span>
                  <span className="text-sm text-text-primary">{option.label}</span>
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-semantic-error/10 p-3 text-sm text-semantic-error"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestion === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        {currentQuestion === TOTAL_QUESTIONS - 1 && allAnswered ? (
          <Button onClick={handleSubmit} isLoading={isPending}>
            Finalizar
            <CheckCircle className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={selectedValue === undefined || currentQuestion === TOTAL_QUESTIONS - 1}
          >
            Proxima
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Result View ────────────────────────────────────────────────────────

function BigFiveResultView({
  scores,
  isFromCooldown,
}: {
  scores: BigFiveScores
  isFromCooldown: boolean
}) {
  const dimensions: BigFiveDimension[] = [
    "openness",
    "conscientiousness",
    "extraversion",
    "agreeableness",
    "neuroticism",
  ]

  const chartData = dimensions.map((dim) => ({
    subject: BIG_FIVE_DIMENSION_LABELS[dim],
    score: (scores as unknown as Record<string, number>)[dim] ?? 0,
    fullMark: 100,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {isFromCooldown ? "Seu resultado anterior" : "Resultado — Big Five"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isFromCooldown
            ? "Este e o seu ultimo resultado registrado."
            : "Confira seu perfil de personalidade baseado nas suas respostas."}
        </p>
      </div>

      {/* Radar Chart */}
      <Card>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "var(--color-text-secondary, #a0a0a0)", fontSize: 12 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={6}
                tick={{ fill: "var(--color-text-secondary, #a0a0a0)", fontSize: 10 }}
              />
              <Radar
                dataKey="score"
                stroke="var(--color-cerrado-600, #2a6ab0)"
                fill="var(--color-cerrado-600, #2a6ab0)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Dimension details */}
      <div className="space-y-3">
        {dimensions.map((dim) => {
          const score = (scores as unknown as Record<string, number>)[dim] ?? 0
          const label = BIG_FIVE_DIMENSION_LABELS[dim]
          const description = getDimensionDescription(dim, score)

          return (
            <Card key={dim}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">{label}</h3>
                  <span className="text-lg font-bold text-cerrado-600">{score}%</span>
                </div>
                <ProgressBar value={score} max={100} size="sm" className="mb-2" />
                <p className="text-xs text-text-secondary">{description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
