"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@eximia/ui"
import {
  FileSearch,
  PenTool,
  Calculator,
  ShieldCheck,
  Cog,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react"

const PHASES = [
  { id: "content_analyzer", label: "Analisando Conteúdo", icon: FileSearch },
  { id: "architect", label: "Projetando Arquitetura", icon: PenTool },
  { id: "calculator", label: "Calculando Métricas", icon: Calculator },
  { id: "validator", label: "Validando Qualidade", icon: ShieldCheck },
  { id: "generator", label: "Gerando Blueprint", icon: Cog },
] as const

type PhaseStatus = "pending" | "running" | "completed" | "error"

interface PhaseState {
  status: PhaseStatus
  message?: string
}

interface DesignProgressProps {
  jobId: string | null
}

export function DesignProgress({ jobId }: DesignProgressProps) {
  const [phases, setPhases] = useState<Record<string, PhaseState>>(() =>
    Object.fromEntries(PHASES.map((p) => [p.id, { status: "pending" as PhaseStatus }])),
  )
  const [overallStatus, setOverallStatus] = useState<
    "running" | "completed" | "error"
  >("running")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll job status if we have a jobId
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/course-designer/jobs/${jobId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.phase_results) {
          const newPhases: Record<string, PhaseState> = {}
          for (const phase of PHASES) {
            const result = data.phase_results[phase.id]
            if (result) {
              newPhases[phase.id] = {
                status: result.error ? "error" : "completed",
                message: result.error || undefined,
              }
            } else if (data.current_phase === phase.id) {
              newPhases[phase.id] = { status: "running" }
            } else {
              newPhases[phase.id] = { status: "pending" }
            }
          }
          setPhases(newPhases)
        }

        if (data.status === "completed") {
          setOverallStatus("completed")
          if (pollingRef.current) clearInterval(pollingRef.current)
        } else if (data.status === "failed") {
          setOverallStatus("error")
          setErrorMessage(data.error || "Falha na geração")
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch {
        // silently retry
      }
    }

    pollingRef.current = setInterval(poll, 2000)
    poll()

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [jobId])

  const getPhaseIcon = (status: PhaseStatus, DefaultIcon: typeof FileSearch) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-semantic-success" />
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-accent-blue-mid" />
      case "error":
        return <XCircle className="h-5 w-5 text-semantic-error" />
      default:
        return <DefaultIcon className="h-5 w-5 text-text-muted" />
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary">
          {overallStatus === "completed"
            ? "Blueprint Gerado!"
            : overallStatus === "error"
              ? "Erro na Geração"
              : "Gerando Blueprint..."}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {overallStatus === "running" &&
            "O pipeline está processando o brief. Isso pode levar alguns minutos."}
          {overallStatus === "completed" &&
            "Redirecionando para o visualizador..."}
          {overallStatus === "error" && errorMessage}
        </p>
      </div>

      {/* Phase Steps */}
      <div className="space-y-1">
        {PHASES.map((phase, idx) => {
          const state = phases[phase.id] || { status: "pending" }
          return (
            <div key={phase.id} className="flex items-center gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    state.status === "completed"
                      ? "border-semantic-success bg-semantic-success/10"
                      : state.status === "running"
                        ? "border-accent-blue-mid bg-accent-blue-mid/10"
                        : state.status === "error"
                          ? "border-semantic-error bg-semantic-error/10"
                          : "border-border-subtle bg-bg-surface",
                  )}
                >
                  {getPhaseIcon(state.status, phase.icon)}
                </div>
                {idx < PHASES.length - 1 && (
                  <div
                    className={cn(
                      "h-4 w-0.5",
                      state.status === "completed"
                        ? "bg-semantic-success"
                        : "bg-border-subtle",
                    )}
                  />
                )}
              </div>

              {/* Label */}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    state.status === "completed"
                      ? "text-semantic-success"
                      : state.status === "running"
                        ? "text-accent-blue-mid"
                        : state.status === "error"
                          ? "text-semantic-error"
                          : "text-text-muted",
                  )}
                >
                  {phase.label}
                </p>
                {state.message && (
                  <p className="text-xs text-semantic-error">{state.message}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
