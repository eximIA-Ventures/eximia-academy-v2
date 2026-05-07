"use client"

import type { OrganizerOutput } from "@eximia/agents"
import { Button, ProgressBar } from "@eximia/ui"
import { useCallback, useEffect, useRef, useState } from "react"

interface ProcessingStatusProps {
  ingestionId: string
  onComplete: (output: OrganizerOutput) => void
  onError: (message: string) => void
  onCancel: () => void
}

const STEPS = [
  { key: "uploading", label: "Enviando arquivo..." },
  { key: "extracting", label: "Extraindo texto..." },
  { key: "processing", label: "Organizando conteúdo com IA..." },
  { key: "review", label: "Pronto para revisao!" },
]

const MAX_ELAPSED_SECONDS = 120

function getStepIndex(status: string, step: string): number {
  if (step.includes("Transcrevendo")) return 1
  if (step.includes("Organizando") || status === "processing") return 2
  if (status === "review") return 3
  if (status === "extracting") return 1
  if (status === "uploading") return 0
  return 0
}

export function ProcessingStatus({
  ingestionId,
  onComplete,
  onError,
  onCancel,
}: ProcessingStatusProps) {
  const [currentStatus, setCurrentStatus] = useState("processing")
  const [currentStep, setCurrentStep] = useState("Organizando conteúdo com IA...")
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stepIndex = getStepIndex(currentStatus, currentStep)
  const progress = Math.min(((stepIndex + 1) / STEPS.length) * 100, 100)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return clearTimer
  }, [clearTimer])

  // Timeout guard
  useEffect(() => {
    if (elapsed >= MAX_ELAPSED_SECONDS) {
      clearTimer()
      onError("Tempo limite excedido. Tente novamente.")
    }
  }, [elapsed, onError, clearTimer])

  // SSE polling for status updates
  useEffect(() => {
    let parseErrorCount = 0
    const maxParseErrors = 3
    const eventSource = new EventSource(`/api/ingestion/${ingestionId}/status`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        parseErrorCount = 0
        setCurrentStatus(data.status)
        if (data.step) setCurrentStep(data.step)

        if (data.status === "review" && data.ai_output) {
          eventSource.close()
          clearTimer()
          onComplete(data.ai_output as OrganizerOutput)
        }

        if (data.status === "failed") {
          eventSource.close()
          clearTimer()
          onError(data.error || "Erro no processamento.")
        }
      } catch (err) {
        parseErrorCount++
        console.error("SSE parse error:", err, "raw:", event.data)
        if (parseErrorCount >= maxParseErrors) {
          eventSource.close()
          clearTimer()
          onError("Erro ao receber dados do servidor.")
        }
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Give the synchronous process route response a chance to resolve first.
      // If the wizard hasn't already handled completion, notify the user after a short delay.
      setTimeout(() => {
        // Only call onError if the component is still mounted and processing
        onError("Conexão perdida com o servidor. Tente novamente.")
      }, 3000)
    }

    return () => {
      eventSource.close()
    }
  }, [ingestionId, onComplete, onError, clearTimer])

  return (
    <div className="flex flex-col items-center py-12">
      {/* Spinner */}
      <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-bg-elevated border-t-cerrado-600" />

      <h2 className="text-lg font-semibold text-text-primary">{currentStep}</h2>
      <p className="mt-2 text-sm text-text-muted">
        Isso pode levar ate 30 segundos... ({elapsed}s)
      </p>

      {/* Progress bar */}
      <div className="mt-6 w-full max-w-md">
        <ProgressBar value={progress} className="h-2" />
      </div>

      {/* Step list */}
      <div className="mt-6 space-y-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                i < stepIndex
                  ? "bg-semantic-success/20 text-semantic-success"
                  : i === stepIndex
                    ? "bg-cerrado-600/20 text-cerrado-600"
                    : "bg-bg-elevated text-text-muted"
              }`}
            >
              {i < stepIndex ? (
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-sm ${i <= stepIndex ? "text-text-primary" : "text-text-muted"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={onCancel} className="mt-8">
        Cancelar
      </Button>
    </div>
  )
}
