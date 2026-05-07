"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, FormProvider, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Card, CardContent, useToast } from "@eximia/ui"
import { courseDesignerInputSchema, type CourseDesignerInput } from "@eximia/course-designer"
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react"
import { PurposeStep } from "./purpose-step"
import { AudienceStep } from "./audience-step"
import { ScopeStep } from "./scope-step"
import { ConstraintsStep } from "./constraints-step"
import { PreferencesStep } from "./preferences-step"
import { PrevalidationStep } from "./prevalidation-step"
import { DesignProgress } from "./design-progress"

const STEPS = [
  { id: 1, label: "Propósito", fields: ["course_title", "business_goal", "behavior_change"] as const },
  { id: 2, label: "Audiência", fields: ["target_audience"] as const },
  { id: 3, label: "Escopo", fields: [] as const },
  { id: 4, label: "Restrições", fields: ["total_duration_hours"] as const },
  { id: 5, label: "Preferências", fields: ["framework"] as const },
  { id: 6, label: "Gerar", fields: [] as const },
] as const

interface CourseDesignerWizardProps {
  tenantId: string
}

export function CourseDesignerWizard({ tenantId }: CourseDesignerWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const initialStep = Number(searchParams.get("step")) || 1
  const [currentStep, setCurrentStep] = useState(Math.min(Math.max(initialStep, 1), 6))
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [isFillingWithAI, setIsFillingWithAI] = useState(false)

  const form = useForm<CourseDesignerInput>({
    resolver: zodResolver(courseDesignerInputSchema) as Resolver<CourseDesignerInput>,
    mode: "onChange",
    defaultValues: {
      course_title: "",
      business_goal: "",
      behavior_change: "",
      success_metrics: [],
      target_audience: {
        role: "",
        experience_level: "intermediario",
      },
      total_duration_hours: 8,
      framework: "auto",
      interaction_strategy: "bloom_mapped",
      language: "pt-br",
    },
  })

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.min(Math.max(step, 1), 6)
      setCurrentStep(clamped)
      const params = new URLSearchParams(searchParams.toString())
      params.set("step", String(clamped))
      window.history.replaceState(null, "", `?${params.toString()}`)
    },
    [searchParams],
  )

  const canAdvance = useCallback(() => {
    const step = STEPS[currentStep - 1]
    if (!step.fields.length) return true
    return step.fields.every((field) => {
      const value = form.getValues(field as keyof CourseDesignerInput)
      if (typeof value === "string") return value.trim().length > 0
      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>
        if ("role" in obj) return (obj.role as string)?.trim().length > 0
        return true
      }
      if (typeof value === "number") return value > 0
      return !!value
    })
  }, [currentStep, form])

  const handleNext = () => {
    if (currentStep < 6) goToStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) goToStep(currentStep - 1)
  }

  const handleAIFill = async () => {
    setIsFillingWithAI(true)
    try {
      const filledFields = form.getValues()
      const res = await fetch("/api/course-designer/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep, filled_fields: filledFields }),
      })
      if (!res.ok) throw new Error("Falha ao preencher com IA")
      const data = await res.json()
      if (data.suggestions) {
        for (const [key, suggestion] of Object.entries(data.suggestions)) {
          const { value } = suggestion as { value: unknown; confidence: number }
          if (value !== undefined && value !== null) {
            form.setValue(key as keyof CourseDesignerInput, value as never, {
              shouldValidate: true,
            })
          }
        }
        toast({ variant: "success", title: "Campos preenchidos com IA" })
      }
    } catch {
      toast({ variant: "error", title: "Erro ao preencher com IA" })
    } finally {
      setIsFillingWithAI(false)
    }
  }

  const handleGenerate = async () => {
    const values = form.getValues()
    setIsGenerating(true)

    try {
      const res = await fetch("/api/course-designer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao iniciar geração")
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("SSE stream não disponível")

      const decoder = new TextDecoder()
      let blueprintId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split("\n").filter((l) => l.startsWith("data: "))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "job_created") {
              setJobId(data.job_id)
            }
            if (data.status === "completed" && data.blueprint_id) {
              blueprintId = data.blueprint_id
            }
          } catch {
            // skip heartbeat or malformed lines
          }
        }
      }

      if (blueprintId) {
        router.push(`/courses/${blueprintId}/blueprint`)
      }
    } catch (err) {
      toast({ variant: "error", title: (err as Error).message })
      setIsGenerating(false)
    }
  }

  if (isGenerating) {
    return <DesignProgress jobId={jobId} />
  }

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Stepper */}
        <nav className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-cerrado-600 text-white"
                      : isCompleted
                        ? "bg-cerrado-600/20 text-cerrado-600"
                        : "bg-bg-elevated text-text-muted"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isActive
                        ? "bg-white/20"
                        : isCompleted
                          ? "bg-cerrado-600/30"
                          : "bg-bg-hover"
                    }`}
                  >
                    {isCompleted ? "✓" : step.id}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-px w-4 sm:w-8 ${isCompleted ? "bg-cerrado-600" : "bg-bg-elevated"}`}
                  />
                )}
              </div>
            )
          })}
        </nav>

        {/* Step Content */}
        <Card className="bg-bg-card border-border-subtle">
          <CardContent className="p-6">
            {currentStep === 1 && <PurposeStep />}
            {currentStep === 2 && <AudienceStep />}
            {currentStep === 3 && <ScopeStep />}
            {currentStep === 4 && <ConstraintsStep />}
            {currentStep === 5 && <PreferencesStep />}
            {currentStep === 6 && (
              <PrevalidationStep onGenerate={handleGenerate} />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 6 && (
              <Button
                variant="outline"
                onClick={handleAIFill}
                disabled={isFillingWithAI}
              >
                {isFillingWithAI ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Preencher com IA
              </Button>
            )}

            {currentStep < 6 && (
              <Button onClick={handleNext} disabled={!canAdvance()}>
                Próximo
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  )
}
