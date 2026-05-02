"use client"

import { GraduationCap, Rocket, Users } from "lucide-react"

type PlatformStatus = "new_needs_onboarding" | "new_already_onboarded" | "existing"

interface StepPlatformStatusProps {
  value?: PlatformStatus
  onChange: (status: PlatformStatus) => void
}

const OPTIONS = [
  {
    value: "new_needs_onboarding" as const,
    icon: Rocket,
    title: "É minha primeira vez aqui",
    description: "Quero conhecer a plataforma e descobrir meu perfil de aprendizagem",
  },
  {
    value: "new_already_onboarded" as const,
    icon: GraduationCap,
    title: "Já conheço a plataforma",
    description: "Quero ir direto para os cursos disponíveis",
  },
  {
    value: "existing" as const,
    icon: Users,
    title: "Estou retornando",
    description: "Já uso a plataforma e quero continuar de onde parei",
  },
]

export function StepEmployeeStatus({ value, onChange }: StepPlatformStatusProps) {
  return (
    <div>
      <h2 className="mb-2 text-center text-xl font-bold text-text-primary">
        Como podemos te ajudar?
      </h2>
      <p className="mb-6 text-center text-text-secondary">
        Isso nos ajuda a personalizar sua experiência na plataforma.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {OPTIONS.map((option) => {
          const isSelected = value === option.value
          const Icon = option.icon
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                isSelected
                  ? "border-accent-blue-mid bg-accent-blue-mid/10"
                  : "border-border-medium bg-bg-card hover:border-border-light"
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isSelected
                    ? "bg-accent-blue-mid/20 text-accent-blue-mid"
                    : "bg-bg-surface text-text-secondary"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{option.title}</p>
                <p className="mt-1 text-xs text-text-muted">{option.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
