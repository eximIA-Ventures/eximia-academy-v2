"use client"

import { useFormContext } from "react-hook-form"
import { Label } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { FrameworkSelector } from "./framework-selector"

const INTERACTION_OPTIONS = [
  {
    value: "bloom_mapped",
    label: "Bloom Mapped",
    description: "Interações mapeadas aos 6 níveis de Bloom",
  },
  {
    value: "dominant",
    label: "Dominante",
    description: "Uma interação predominante em todos os módulos",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Definir manualmente por módulo após geração",
  },
]

const DOMINANT_TYPES = [
  { value: "socratic_dialogue", label: "Diálogo Pedagógico" },
  { value: "quiz", label: "Quiz" },
  { value: "scenario", label: "Cenário" },
  { value: "assignment", label: "Atividade Prática" },
]

const LANGUAGE_OPTIONS = [
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "en", label: "English" },
]

export function PreferencesStep() {
  const { register, watch } = useFormContext<CourseDesignerInput>()
  const interactionStrategy = watch("interaction_strategy")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          5. Preferências de Design
        </h2>
        <p className="text-sm text-text-secondary">
          Escolha o framework pedagógico e a estratégia de interação
        </p>
      </div>

      {/* Framework Selector */}
      <div className="space-y-3">
        <Label>Framework Pedagógico</Label>
        <FrameworkSelector />
      </div>

      {/* Interaction Strategy */}
      <div className="space-y-3">
        <Label>Estratégia de Interação</Label>
        <div className="space-y-2">
          {INTERACTION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-md shadow-card bg-bg-surface p-3 transition-colors hover:border-border-medium"
            >
              <input
                type="radio"
                value={opt.value}
                {...register("interaction_strategy")}
                className="mt-0.5 accent-cerrado-600"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {opt.label}
                </p>
                <p className="text-xs text-text-muted">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Dominant Type (conditional) */}
      {interactionStrategy === "dominant" && (
        <div className="space-y-2">
          <Label htmlFor="dominant_interaction_type">
            Tipo de Interação Dominante
          </Label>
          <select
            id="dominant_interaction_type"
            className="flex h-10 w-full rounded-md shadow-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
            {...register("dominant_interaction_type")}
          >
            <option value="">Selecione...</option>
            {DOMINANT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Language */}
      <div className="space-y-2">
        <Label htmlFor="language">Idioma do Blueprint</Label>
        <select
          id="language"
          className="flex h-10 w-full rounded-md shadow-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
          {...register("language")}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
