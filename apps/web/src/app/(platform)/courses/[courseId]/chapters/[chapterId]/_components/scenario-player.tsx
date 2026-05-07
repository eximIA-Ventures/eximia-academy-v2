"use client"

import { Button } from "@eximia/ui"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Factory,
  Lightbulb,
  Loader2,
  Search,
  Target,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ConfettiBurst } from "./confetti-burst"
import { getScenarioAttempt, saveScenarioAttempt } from "./interaction-persistence"

interface ScenarioStep {
  id: string
  title: string
  icon: "search" | "target" | "lightbulb" | "clipboard"
  prompt: string
  hint?: string
}

interface ScenarioData {
  title: string
  company: string
  context: string
  problem: string
  data: string[]
  steps: ScenarioStep[]
}

interface ScenarioPlayerProps {
  scenario: ScenarioData
  chapterId: string
  courseId: string
  onComplete?: () => void
}

const STEP_ICONS = {
  search: Search,
  target: Target,
  lightbulb: Lightbulb,
  clipboard: ClipboardList,
}

type Phase = "briefing" | "solving" | "evaluating" | "results"

interface StepAnswer {
  stepId: string
  answer: string
}

interface Evaluation {
  overallScore: number
  feedback: string
  stepFeedback: Array<{ stepId: string; score: number; comment: string }>
  strengths: string[]
  improvements: string[]
}

export function ScenarioPlayer({ scenario, chapterId, courseId, onComplete }: ScenarioPlayerProps) {
  const [phase, setPhase] = useState<Phase>("briefing")
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [currentInput, setCurrentInput] = useState("")
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [loadingPrevious, setLoadingPrevious] = useState(true)
  const hasMounted = useRef(false)

  const steps = scenario?.steps ?? []
  const data = scenario?.data ?? []
  const currentStep = steps[currentStepIndex]
  const totalSteps = steps.length
  const progress = phase === "briefing" ? 0 : phase === "results" ? 100 : totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0

  // Load existing attempt on mount
  useEffect(() => {
    if (hasMounted.current) return
    hasMounted.current = true

    async function loadSaved() {
      try {
        const saved = await getScenarioAttempt(chapterId)
        if (!saved) return

        // Restore step responses into answers map
        const stepResponses = (saved.step_responses ?? []) as Array<{ stepId: string; response: string }>
        if (stepResponses.length > 0) {
          const restored = new Map<string, string>()
          for (const sr of stepResponses) {
            restored.set(sr.stepId, sr.response)
          }
          setAnswers(restored)
        }

        if (saved.status === "completed" && saved.evaluation) {
          // Restore completed evaluation
          const evalData = saved.evaluation as Record<string, unknown>
          setEvaluation({
            overallScore: (evalData.overallScore as number) ?? 0,
            feedback: (evalData.feedback as string) ?? "",
            stepFeedback: (evalData.stepFeedback as Evaluation["stepFeedback"]) ?? [],
            strengths: (evalData.strengths as string[]) ?? [],
            improvements: (evalData.improvements as string[]) ?? [],
          })
          setPhase("results")
        } else if (stepResponses.length > 0 && stepResponses.length < totalSteps) {
          // Resume in-progress: go to next unanswered step
          setCurrentStepIndex(stepResponses.length)
          setPhase("solving")
        }
      } finally {
        setLoadingPrevious(false)
      }
    }

    loadSaved()
  }, [chapterId, totalSteps])

  if (!scenario || totalSteps === 0) {
    return (
      <div className="rounded-md bg-bg-card p-8 text-center text-text-muted">
        Cenário ainda não configurado para este capítulo.
      </div>
    )
  }

  if (loadingPrevious) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={24} className="animate-spin text-text-muted" />
        <p className="text-sm text-text-muted">Carregando progresso...</p>
      </div>
    )
  }

  const submitStep = useCallback(() => {
    if (!currentInput.trim() || !currentStep) return

    const updatedAnswers = new Map(answers)
    updatedAnswers.set(currentStep.id, currentInput.trim())
    setAnswers(updatedAnswers)

    // Build step responses array for persistence
    const stepResponses = Array.from(updatedAnswers.entries()).map(([stepId, response]) => ({
      stepId,
      response,
    }))

    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1)
      setCurrentInput("")

      // Auto-save in_progress
      saveScenarioAttempt(chapterId, {
        scenarioTitle: scenario.title,
        status: "in_progress",
        stepResponses,
      })
    } else {
      // All steps done — evaluate
      setPhase("evaluating")
      setEvaluating(true)

      // Simulate AI evaluation (in production, call API)
      setTimeout(() => {
        const mockEval: Evaluation = {
          overallScore: 78,
          feedback: "Boa análise estruturada. Você demonstrou compreensão sólida da metodologia AeSP, com identificação clara do problema e causas raízes consistentes.",
          stepFeedback: steps.map((s, i) => ({
            stepId: s.id,
            score: 65 + Math.floor(Math.random() * 30),
            comment: i === 0
              ? "Boa identificação do problema. Poderia ser mais específico nos indicadores."
              : i === 1
                ? "Análise de causas bem estruturada. Considere ampliar para os 6M."
                : i === 2
                  ? "Soluções criativas e alinhadas com as causas identificadas."
                  : "Plano de ação com responsáveis e prazos. Inclua métricas de acompanhamento.",
          })),
          strengths: [
            "Sequência lógica de análise",
            "Identificação de causas raízes",
            "Propostas de ação concretas",
          ],
          improvements: [
            "Incluir dados quantitativos na análise",
            "Expandir a análise para todos os 6M do Ishikawa",
            "Definir KPIs de acompanhamento no plano de ação",
          ],
        }
        setEvaluation(mockEval)
        setPhase("results")
        setEvaluating(false)

        // Persist completed evaluation
        saveScenarioAttempt(chapterId, {
          scenarioTitle: scenario.title,
          status: "completed",
          stepResponses,
          evaluation: {
            overallScore: mockEval.overallScore,
            feedback: mockEval.feedback,
            stepFeedback: mockEval.stepFeedback,
            strengths: mockEval.strengths,
            improvements: mockEval.improvements,
          },
        })
      }, 2500)
    }
  }, [currentInput, currentStep, currentStepIndex, totalSteps, steps, answers, chapterId, scenario?.title])

  const passed = evaluation && evaluation.overallScore >= 70

  // BRIEFING — Case presentation
  if (phase === "briefing") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Case header */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-bg-card to-bg-card border border-amber-500/20 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                <Factory size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">Cenário</p>
                <h2 className="text-lg font-bold text-text-primary">{scenario.title}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Empresa</p>
                <p className="text-sm text-text-primary">{scenario.company}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Contexto</p>
                <p className="text-sm text-text-secondary leading-relaxed">{scenario.context}</p>
              </div>

              <div className="rounded-xl bg-semantic-error/5 border border-semantic-error/20 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-semantic-error shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-semantic-error mb-1">Problema</p>
                    <p className="text-sm text-text-primary leading-relaxed">{scenario.problem}</p>
                  </div>
                </div>
              </div>

              {data.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Dados Disponíveis</p>
                  <div className="space-y-1.5">
                    {data.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-cerrado-600/60" />
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Steps preview */}
          <div className=" bg-bg-surface px-6 py-4 sm:px-8">
            <p className="text-xs font-semibold text-text-muted mb-3">Sua missão ({totalSteps} etapas)</p>
            <div className="flex gap-2">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[step.icon]
                return (
                  <div key={step.id} className="flex items-center gap-1.5 rounded-lg bg-bg-surface px-3 py-1.5 text-[11px] text-text-muted">
                    <Icon size={12} />
                    <span>{step.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={() => setPhase("solving")}>
          Iniciar Resolução
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    )
  }

  // EVALUATING — Loading
  if (phase === "evaluating") {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="animate-spin text-cerrado-600" />
        <p className="text-sm text-text-muted">Analisando suas respostas...</p>
      </div>
    )
  }

  // RESULTS
  if (phase === "results" && evaluation) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <ConfettiBurst trigger={!!passed} />

        {/* Score card */}
        <div className={`rounded-2xl border p-8 text-center space-y-5 ${
          passed
            ? "bg-gradient-to-b from-semantic-success/5 to-bg-card border-semantic-success/20"
            : "bg-gradient-to-b from-amber-500/5 to-bg-card border-amber-500/20"
        }`}>
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${
            passed ? "bg-semantic-success/15 ring-1 ring-semantic-success/20" : "bg-amber-500/15 ring-1 ring-amber-500/20"
          }`}>
            {passed ? <CheckCircle size={36} className="text-semantic-success" /> : <Target size={36} className="text-amber-500" />}
          </div>

          <div>
            <p className="text-4xl font-bold text-text-primary">{evaluation.overallScore}%</p>
            <p className="mt-1 text-text-secondary">{evaluation.feedback}</p>
          </div>

          {/* Score bar */}
          <div className="mx-auto max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div className={`h-full rounded-full transition-all duration-700 ${passed ? "bg-semantic-success" : "bg-amber-500"}`} style={{ width: `${evaluation.overallScore}%` }} />
            </div>
          </div>
        </div>

        {/* Step-by-step feedback */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Avaliação por Etapa</h3>
          {evaluation.stepFeedback.map((sf, i) => {
            const step = steps.find((s) => s.id === sf.stepId)
            const Icon = step ? STEP_ICONS[step.icon] : Search
            return (
              <div key={sf.stepId} className="rounded-xl bg-bg-card shadow-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-cerrado-600" />
                    <span className="text-sm font-medium text-text-primary">{step?.title}</span>
                  </div>
                  <span className={`text-sm font-bold ${sf.score >= 70 ? "text-semantic-success" : "text-amber-500"}`}>{sf.score}%</span>
                </div>
                <p className="text-xs text-text-muted">{sf.comment}</p>
                <div className="mt-2 rounded-lg bg-bg-elevated p-3">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Sua resposta</p>
                  <p className="text-xs text-text-secondary">{answers.get(sf.stepId)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Strengths & improvements */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-semantic-success/5 border border-semantic-success/15 p-4">
            <p className="text-xs font-semibold text-semantic-success mb-2">Pontos Fortes</p>
            {evaluation.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-secondary mt-1.5">
                <CheckCircle size={12} className="text-semantic-success shrink-0 mt-0.5" />
                {s}
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4">
            <p className="text-xs font-semibold text-amber-500 mb-2">Oportunidades</p>
            {evaluation.improvements.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-secondary mt-1.5">
                <Lightbulb size={12} className="text-amber-500 shrink-0 mt-0.5" />
                {s}
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => {
          setPhase("briefing")
          setCurrentStepIndex(0)
          setAnswers(new Map())
          setCurrentInput("")
          setEvaluation(null)
        }}>
          Tentar Novamente
        </Button>
      </div>
    )
  }

  // SOLVING — Step by step
  if (!currentStep) return null
  const StepIcon = STEP_ICONS[currentStep.icon]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Etapa {currentStepIndex + 1} de {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step card */}
      <div className="rounded-2xl bg-bg-card shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <StepIcon size={20} className="text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">Etapa {currentStepIndex + 1}</p>
            <h3 className="text-base font-semibold text-text-primary">{currentStep.title}</h3>
          </div>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">{currentStep.prompt}</p>

        {currentStep.hint && (
          <div className="flex items-start gap-2 rounded-lg bg-cerrado-600/5 border border-cerrado-600/15 p-3">
            <Lightbulb size={14} className="text-cerrado-600 shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted">{currentStep.hint}</p>
          </div>
        )}

        <textarea
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          rows={6}
          className="w-full rounded-xl shadow-card bg-bg-primary p-4 text-sm text-text-primary placeholder:text-text-muted focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 resize-y"
          placeholder="Escreva sua análise..."
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {currentInput.length > 0 ? `${currentInput.split(/\s+/).filter(Boolean).length} palavras` : ""}
          </span>
          <Button onClick={submitStep} disabled={!currentInput.trim()}>
            {currentStepIndex < totalSteps - 1 ? "Próxima Etapa" : "Finalizar"}
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Completed steps */}
      {currentStepIndex > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-muted">Etapas concluídas</p>
          {steps.slice(0, currentStepIndex).map((s) => {
            const Icon = STEP_ICONS[s.icon]
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-bg-card/50 shadow-card px-3 py-2">
                <CheckCircle size={14} className="text-semantic-success" />
                <Icon size={12} className="text-text-muted" />
                <span className="text-xs text-text-muted flex-1">{s.title}</span>
                <span className="text-[10px] text-text-muted/60 truncate max-w-[150px]">{answers.get(s.id)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
