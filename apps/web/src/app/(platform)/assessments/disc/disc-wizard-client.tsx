"use client"

import { type DISCResult, DISC_ITEMS, scoreDISC } from "@/components/profile/scoring"
import {
  DISC_COMBO_LABELS,
  DISC_TYPE_DESCRIPTIONS,
  DISC_TYPE_NAMES,
  getDominantType,
} from "@/lib/assessments/disc-type-labels"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ProgressBar } from "@eximia/ui"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts"
import { submitDiscAssessment } from "./actions"

const DISC_DIMENSION_COLORS: Record<string, string> = {
  D: "bg-accent-red",
  I: "bg-accent-gold",
  S: "bg-accent-green",
  C: "bg-cerrado-600",
}

interface DiscWizardClientProps {
  userId: string
  onCooldown: boolean
  remainingDays: number
  previousResult: {
    d: number
    i: number
    s: number
    c: number
    dominantType: string
    secondaryType: string
    typeLabel: string
  } | null
}

type WizardPhase = "intro" | "questions" | "submitting" | "result" | "cooldown"

export function DiscWizardClient({
  onCooldown,
  remainingDays,
  previousResult,
}: DiscWizardClientProps) {
  const [phase, setPhase] = useState<WizardPhase>(() => {
    if (onCooldown && previousResult) return "cooldown"
    return "intro"
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, "a" | "b">>({})
  const [result, setResult] = useState<DISCResult | null>(
    previousResult
      ? { d: previousResult.d, i: previousResult.i, s: previousResult.s, c: previousResult.c }
      : null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  const totalItems = DISC_ITEMS.length
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / totalItems) * 100
  const currentItem = DISC_ITEMS[currentIndex]

  const handleAnswer = useCallback(
    (choice: "a" | "b") => {
      const item = DISC_ITEMS[currentIndex]
      setAnswers((prev) => ({ ...prev, [item.id]: choice }))

      // Auto-advance to next question after a brief moment
      if (currentIndex < totalItems - 1) {
        setTimeout(() => setCurrentIndex((prev) => prev + 1), 200)
      }
    },
    [currentIndex, totalItems],
  )

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex])

  const handleNext = useCallback(() => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [currentIndex, totalItems])

  const handleSubmit = useCallback(async () => {
    setPhase("submitting")
    setSubmitError(null)

    try {
      const scores = scoreDISC(answers)
      const response = await submitDiscAssessment(answers)

      if (response.error) {
        setSubmitError(response.error)
        setPhase("questions")
        return
      }

      setResult(scores)
      setPhase("result")
    } catch {
      setSubmitError("Erro inesperado ao salvar. Tente novamente.")
      setPhase("questions")
    }
  }, [answers])

  const handleRetake = useCallback(() => {
    setAnswers({})
    setCurrentIndex(0)
    setResult(null)
    setSubmitError(null)
    setPhase("intro")
  }, [])

  // ─── Cooldown View ─────────────────────────────────────────────────────
  if (phase === "cooldown" && previousResult) {
    return (
      <ResultView
        result={{
          d: previousResult.d,
          i: previousResult.i,
          s: previousResult.s,
          c: previousResult.c,
        }}
        isCooldown
        remainingDays={remainingDays}
      />
    )
  }

  // ─── Intro View ────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Assessment DISC</h1>
          <p className="mt-2 text-text-secondary">
            O DISC e um modelo comportamental que identifica quatro dimensoes do seu perfil de
            comunicacao e trabalho.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              {(["D", "I", "S", "C"] as const).map((dim) => (
                <div key={dim} className="rounded-lg shadow-card bg-bg-surface p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${DISC_DIMENSION_COLORS[dim]}`} />
                    <span className="text-sm font-semibold text-text-primary">
                      {dim} — {DISC_TYPE_NAMES[dim]}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Como funciona</h3>
              <ul className="space-y-1 text-sm text-text-secondary">
                <li>Você vera 28 pares de afirmacoes</li>
                <li>Escolha a opcao que mais descreve voce</li>
                <li>Nao ha respostas certas ou erradas</li>
                <li>Tempo estimado: 5-8 minutos</li>
              </ul>
            </div>

            <p className="text-xs text-text-muted">
              Todos os perfis são validos e trazem contribuicoes unicas para equipes e organizacoes.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => setPhase("questions")}>
            Iniciar Assessment
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ─── Submitting View ───────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cerrado-600 border-t-transparent" />
        <p className="text-sm text-text-secondary">Calculando seu perfil...</p>
      </div>
    )
  }

  // ─── Result View ───────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return <ResultView result={result} onRetake={handleRetake} />
  }

  // ─── Questions View ────────────────────────────────────────────────────
  const currentAnswer = currentItem ? answers[currentItem.id] : undefined
  const allAnswered = answeredCount === totalItems

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setPhase("intro")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">DISC</h2>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
          <span>
            Pergunta {currentIndex + 1} de {totalItems}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      {/* Question Card */}
      {currentItem && (
        <Card>
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-medium text-text-muted">
              Qual opcao descreve mais voce?
            </p>

            <div
              className="mt-4 flex flex-col gap-3"
              role="radiogroup"
              aria-label="Selecione sua resposta"
            >
              {(["a", "b"] as const).map((choice) => {
                const option = currentItem[choice]
                const isSelected = currentAnswer === choice
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleAnswer(choice)}
                    className={`w-full rounded-lg px-5 py-4 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 ${
                      isSelected
                        ? "border-2 border-cerrado-600 bg-cerrado-600/10 text-text-primary"
                        : "border-2 border-border-medium bg-bg-surface text-text-secondary hover:border-cerrado-600/50 hover:bg-bg-surface/80"
                    }`}
                  >
                    <span className="mr-2 inline-block font-bold text-text-muted uppercase">
                      {choice}.
                    </span>
                    {option.text}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={currentIndex === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        {allAnswered ? (
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Ver Resultado
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex === totalItems - 1 || !currentAnswer}
          >
            Proxima
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Question indicator dots */}
      <div className="flex flex-wrap justify-center gap-1.5 pt-2">
        {DISC_ITEMS.map((item, idx) => {
          const isAnswered = item.id in answers
          const isCurrent = idx === currentIndex
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Pergunta ${idx + 1}`}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                isCurrent
                  ? "bg-cerrado-600 ring-2 ring-cerrado-600/30"
                  : isAnswered
                    ? "bg-semantic-success"
                    : "bg-border-medium"
              }`}
            />
          )
        })}
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-semantic-error/20 bg-semantic-error/5 px-4 py-3"
        >
          <p className="text-sm text-semantic-error">{submitError}</p>
        </div>
      )}
    </div>
  )
}

// ─── Result View Component ─────────────────────────────────────────────────

interface ResultViewProps {
  result: DISCResult
  isCooldown?: boolean
  remainingDays?: number
  onRetake?: () => void
}

function ResultView({ result, isCooldown, remainingDays, onRetake }: ResultViewProps) {
  const typeInfo = getDominantType(result)
  const maxVal = Math.max(result.d, result.i, result.s, result.c, 1)

  const chartData = [
    { subject: "Dominancia (D)", value: result.d },
    { subject: "Influencia (I)", value: result.i },
    { subject: "Estabilidade (S)", value: result.s },
    { subject: "Conformidade (C)", value: result.c },
  ]

  const dominantDesc = DISC_TYPE_DESCRIPTIONS[typeInfo.dominant]
  const comboDesc = DISC_COMBO_LABELS[`${typeInfo.dominant}${typeInfo.secondary}_desc`] ?? ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Resultado DISC</h1>
        <p className="mt-1 text-text-secondary">Seu perfil comportamental completo</p>
      </div>

      {isCooldown && remainingDays !== undefined && remainingDays > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-accent-gold/30 bg-accent-gold/5 px-4 py-3">
          <Clock className="h-4 w-4 text-accent-gold" />
          <p className="text-sm text-text-secondary">
            Você podera refazer este assessment em {remainingDays} dia{remainingDays > 1 ? "s" : ""}
            .
          </p>
        </div>
      )}

      {/* Dominant Type Badge */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seu Tipo Dominante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white ${
                DISC_DIMENSION_COLORS[typeInfo.dominant]
              }`}
            >
              {typeInfo.dominant}
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">
                {DISC_TYPE_NAMES[typeInfo.dominant]}
              </p>
              <Badge variant="info" className="mt-0.5">
                {typeInfo.label}
              </Badge>
            </div>
          </div>
          {comboDesc && <p className="text-sm text-text-secondary">{comboDesc}</p>}
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Perfil Visual</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="var(--color-border-medium)" />
              <PolarAngleAxis
                dataKey="subject"
                className="text-xs"
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                domain={[0, Math.ceil(maxVal / 10) * 10]}
                tickCount={5}
                tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
              />
              <Radar
                dataKey="value"
                stroke="var(--color-cerrado-600)"
                fill="var(--color-cerrado-600)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Score Bars */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pontuacao por Dimensao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              { key: "d" as const, dim: "D", label: "Dominancia (D)" },
              { key: "i" as const, dim: "I", label: "Influencia (I)" },
              { key: "s" as const, dim: "S", label: "Estabilidade (S)" },
              { key: "c" as const, dim: "C", label: "Conformidade (C)" },
            ] as const
          ).map(({ key, dim, label }) => {
            const value = result[key]
            const width = Math.max((value / maxVal) * 100, 4)
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                  <span className="text-sm font-bold text-cerrado-600">{value}%</span>
                </div>
                <div
                  className="h-4 overflow-hidden rounded-full bg-bg-surface"
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={label}
                >
                  <div
                    className={`h-full rounded-full ${DISC_DIMENSION_COLORS[dim]} transition-all duration-500`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Type Description */}
      {dominantDesc && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              Sobre o Perfil {DISC_TYPE_NAMES[typeInfo.dominant]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-1 text-sm font-semibold text-semantic-success">Pontos Fortes</h4>
              <p className="text-sm text-text-secondary">{dominantDesc.strengths}</p>
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-accent-gold">Pontos de Atencao</h4>
              <p className="text-sm text-text-secondary">{dominantDesc.challenges}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-judgmental message */}
      <div className="rounded-lg shadow-card bg-bg-surface px-4 py-3">
        <p className="text-center text-xs text-text-muted">
          Todos os perfis são validos e trazem contribuicoes unicas para equipes e organizacoes. O
          DISC identifica tendencias comportamentais, nao limitacoes.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Perfil
        </Link>
        {onRetake && !isCooldown && (
          <Button variant="ghost" size="sm" onClick={onRetake}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Refazer Assessment
          </Button>
        )}
      </div>
    </div>
  )
}
