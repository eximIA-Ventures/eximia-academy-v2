"use client"

import { useFormContext } from "react-hook-form"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { Sparkles, RotateCcw, Lightbulb, Target } from "lucide-react"
import { cn } from "@eximia/ui"

const FRAMEWORKS = [
  {
    id: "auto" as const,
    label: "Auto-Select",
    subtitle: "Recomendado",
    description: "O sistema escolhe o melhor framework com base no perfil do curso",
    icon: Sparkles,
    color: "accent-blue-mid",
  },
  {
    id: "elc_plus" as const,
    label: "ELC+",
    subtitle: "Experiential Learning Cycle",
    description:
      "Aprendizado experiencial com 5 fases: Engajar, Explorar, Explicar, Elaborar, Avaliar",
    icon: RotateCcw,
    color: "accent-purple",
  },
  {
    id: "kolb_4" as const,
    label: "Kolb 4",
    subtitle: "Kolb's Learning Cycle",
    description:
      "Ciclo de 4 estágios: Experiência Concreta, Observação Reflexiva, Conceituação Abstrata, Experimentação Ativa",
    icon: Target,
    color: "accent-teal",
  },
  {
    id: "pbl_hmelo" as const,
    label: "PBL Hmelo",
    subtitle: "Problem-Based Learning",
    description:
      "Aprendizagem baseada em problemas: Problema-Motor, Hipóteses, Investigação, Síntese, Reflexão",
    icon: Lightbulb,
    color: "accent-orange",
  },
] as const

export function FrameworkSelector() {
  const { watch, setValue } = useFormContext<CourseDesignerInput>()
  const selected = watch("framework")

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FRAMEWORKS.map((fw) => {
        const isSelected = selected === fw.id
        const Icon = fw.icon
        return (
          <button
            key={fw.id}
            type="button"
            onClick={() => setValue("framework", fw.id)}
            className={cn(
              "relative flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-all",
              isSelected
                ? "border-accent-blue-mid bg-accent-blue-mid/5"
                : "border-border-subtle bg-bg-surface hover:border-border-medium",
            )}
          >
            {fw.id === "auto" && (
              <span className="absolute right-3 top-3 rounded-full bg-accent-blue-mid/20 px-2 py-0.5 text-xs font-medium text-accent-blue-mid">
                Recomendado
              </span>
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md",
                  isSelected
                    ? "bg-accent-blue-mid text-white"
                    : "bg-bg-elevated text-text-secondary",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {fw.label}
                </p>
                <p className="text-xs text-text-muted">{fw.subtitle}</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary">{fw.description}</p>
          </button>
        )
      })}
    </div>
  )
}
