"use client"

import { useFormContext } from "react-hook-form"
import { Input, Label, Textarea, Badge, Button, Select } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { Plus, X } from "lucide-react"
import { useState } from "react"

const EXPERIENCE_LEVELS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "especialista", label: "Especialista" },
]

const ENVIRONMENT_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
]

const AUTONOMY_OPTIONS = [
  { value: "guiado", label: "Guiado" },
  { value: "semi_autonomo", label: "Semi-autônomo" },
  { value: "autonomo", label: "Autônomo" },
]

export function AudienceStep() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<CourseDesignerInput>()
  const [knowledgeInput, setKnowledgeInput] = useState("")
  const priorKnowledge = watch("target_audience.prior_knowledge") ?? []

  const addKnowledge = () => {
    const trimmed = knowledgeInput.trim()
    if (!trimmed) return
    setValue("target_audience.prior_knowledge", [...priorKnowledge, trimmed])
    setKnowledgeInput("")
  }

  const removeKnowledge = (index: number) => {
    setValue(
      "target_audience.prior_knowledge",
      priorKnowledge.filter((_, i) => i !== index),
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          2. Audiência
        </h2>
        <p className="text-sm text-text-secondary">
          Defina quem vai participar do curso e seu perfil
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="target_audience.role">
            Cargo / Função <span className="text-semantic-error">*</span>
          </Label>
          <Input
            id="target_audience.role"
            placeholder="Ex: Gerente de Operações"
            {...register("target_audience.role")}
          />
          {errors.target_audience?.role && (
            <p className="text-sm text-semantic-error">
              {errors.target_audience.role.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience_level">
            Nível de Experiência <span className="text-semantic-error">*</span>
          </Label>
          <select
            id="experience_level"
            className="flex h-10 w-full rounded-md border border-border-medium bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue-mid focus:outline-none"
            {...register("target_audience.experience_level")}
          >
            {EXPERIENCE_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group_size">Tamanho da Turma</Label>
          <Input
            id="group_size"
            type="number"
            min={1}
            max={500}
            placeholder="Ex: 25"
            {...register("target_audience.group_size", { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="learning_environment">Ambiente de Aprendizagem</Label>
          <select
            id="learning_environment"
            className="flex h-10 w-full rounded-md border border-border-medium bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue-mid focus:outline-none"
            {...register("target_audience.learning_environment")}
          >
            <option value="">Selecione...</option>
            {ENVIRONMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="autonomy_level">Nível de Autonomia</Label>
          <select
            id="autonomy_level"
            className="flex h-10 w-full rounded-md border border-border-medium bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue-mid focus:outline-none"
            {...register("target_audience.autonomy_level")}
          >
            <option value="">Selecione...</option>
            {AUTONOMY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Conhecimento Prévio (tags)</Label>
        <div className="flex gap-2">
          <Input
            value={knowledgeInput}
            onChange={(e) => setKnowledgeInput(e.target.value)}
            placeholder="Ex: Gestão de projetos básica"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addKnowledge()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addKnowledge}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {priorKnowledge.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {priorKnowledge.map((item, i) => (
              <Badge key={i} variant="default" className="gap-1">
                {item}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => removeKnowledge(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") removeKnowledge(i) }}
                  className="cursor-pointer rounded-full p-0.5 text-text-muted transition-colors hover:bg-semantic-error/20 hover:text-semantic-error"
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivation_context">Contexto de Motivação</Label>
        <Textarea
          id="motivation_context"
          rows={2}
          placeholder="O que motiva os participantes? Há pressão por resultados?"
          {...register("target_audience.motivation_context")}
        />
      </div>
    </div>
  )
}
