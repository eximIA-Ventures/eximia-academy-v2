"use client"

import { saveOnboardingProfile, skipOnboarding } from "@/app/onboarding/actions"
import type { OnboardingPayload } from "@/app/onboarding/actions"
import { useTenantNav } from "@/lib/hooks/use-tenant-nav"
import { Button, ProgressBar, useToast } from "@eximia/ui"
import { useCallback, useState, useTransition } from "react"
import { StepEmployeeStatus } from "./step-employee-status"
import { StepWelcome } from "./step-welcome"

interface OnboardingWizardProps {
  userId: string
  tenantId: string
  tenantName: string
}

export interface OnboardingFormData {
  photo_url?: string
  employee_status?: "new_needs_onboarding" | "new_already_onboarded" | "existing"
}

const STEP_LABELS = ["Boas-vindas", "Sua situação"]
const TOTAL_STEPS = 2

export function OnboardingWizard({
  userId,
  tenantId,
  tenantName,
}: OnboardingWizardProps) {
  const { push } = useTenantNav()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<OnboardingFormData>({})
  const { toast } = useToast()

  const updateFormData = useCallback((updates: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1)
      setError(null)
    }
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
      setError(null)
    }
  }, [currentStep])

  const handleComplete = useCallback(() => {
    if (!formData.employee_status) {
      setError("Selecione uma opção para continuar.")
      return
    }

    setError(null)
    startTransition(async () => {
      const payload: OnboardingPayload = {
        profile: {
          employee_status: formData.employee_status!,
          photo_url: formData.photo_url,
        },
      }

      const result = await saveOnboardingProfile(payload)
      if (result.error) {
        setError(result.error)
        return
      }

      if (result.noOnboardingTrail) {
        toast({
          title: "Informação",
          description: "Nenhuma trilha de boas-vindas configurada. Fale com seu gestor.",
          variant: "default",
        })
      }

      push("/dashboard")
    })
  }, [formData, push, toast])

  const handleSkip = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const result = await skipOnboarding()
      if (result.error) {
        setError(result.error)
      } else {
        push("/dashboard")
      }
    })
  }, [push])

  const progressValue = ((currentStep + 1) / TOTAL_STEPS) * 100

  return (
    <div className="w-full max-w-2xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  index <= currentStep
                    ? "bg-accent-blue-mid text-text-primary"
                    : "bg-bg-card text-text-muted"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`hidden text-2xs sm:block ${
                  index <= currentStep ? "text-text-secondary" : "text-text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <ProgressBar value={progressValue} size="sm" />
      </div>

      <div className="mb-8">
        {currentStep === 0 && (
          <StepWelcome
            tenantName={tenantName}
            tenantId={tenantId}
            userId={userId}
            photoUrl={formData.photo_url}
            onChange={(photoUrl) => updateFormData({ photo_url: photoUrl })}
          />
        )}
        {currentStep === 1 && (
          <StepEmployeeStatus
            value={formData.employee_status}
            onChange={(employee_status) => updateFormData({ employee_status })}
          />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button variant="ghost" onClick={handleBack} disabled={isPending}>
              Voltar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="text-sm text-text-muted underline-offset-4 transition-colors hover:text-text-secondary hover:underline disabled:opacity-40"
          >
            Pular
          </button>

          {currentStep < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext} disabled={isPending}>
              Continuar
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isPending}>
              {isPending ? "Salvando..." : "Concluir"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
