"use client"

import { useFormContext } from "react-hook-form"
import { Input, Label, Textarea, Badge, Button } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { Plus, X } from "lucide-react"
import { useState } from "react"
import { CourseSelector } from "./course-selector"

const DENSITY_OPTIONS = [
  { value: "lean", label: "Lean — foco em poucos tópicos essenciais" },
  { value: "moderada", label: "Moderada — equilíbrio entre profundidade e cobertura" },
  { value: "densa", label: "Densa — cobertura ampla com profundidade" },
]

const ASSESSMENT_OPTIONS = [
  { value: "formativa", label: "Formativa — avaliação durante o processo" },
  { value: "somativa", label: "Somativa — avaliação ao final" },
  { value: "mista", label: "Mista — formativa + somativa" },
]

export function ScopeStep() {
  const { register, watch, setValue } = useFormContext<CourseDesignerInput>()

  const [competencyInput, setCompetencyInput] = useState("")
  const [topicInput, setTopicInput] = useState("")

  const competencies = watch("core_competencies") ?? []
  const topics = watch("topics_outline") ?? []

  const addCompetency = () => {
    const trimmed = competencyInput.trim()
    if (!trimmed) return
    setValue("core_competencies", [...competencies, trimmed])
    setCompetencyInput("")
  }

  const addTopic = () => {
    const trimmed = topicInput.trim()
    if (!trimmed) return
    setValue("topics_outline", [...topics, trimmed])
    setTopicInput("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">3. Escopo</h2>
        <p className="text-sm text-text-secondary">
          Defina competências, tópicos e materiais de referência
        </p>
      </div>

      {/* Competencies */}
      <div className="space-y-2">
        <Label>Competências-chave</Label>
        <div className="flex gap-2">
          <Input
            value={competencyInput}
            onChange={(e) => setCompetencyInput(e.target.value)}
            placeholder="Ex: Analisar demonstrações financeiras"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCompetency()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCompetency}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {competencies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {competencies.map((c, i) => (
              <Badge key={i} variant="default" className="gap-1">
                {c}
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "core_competencies",
                      competencies.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Topics */}
      <div className="space-y-2">
        <Label>Tópicos do Curso</Label>
        <div className="flex gap-2">
          <Input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Ex: Fundamentos de análise de dados"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTopic()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTopic}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <Badge key={i} variant="default" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "topics_outline",
                      topics.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content Density & Assessment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="content_density">Densidade de Conteúdo</Label>
          <select
            id="content_density"
            className="flex h-10 w-full rounded-md shadow-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
            {...register("content_density")}
          >
            <option value="">Selecione...</option>
            {DENSITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assessment_preference">Preferência de Avaliação</Label>
          <select
            id="assessment_preference"
            className="flex h-10 w-full rounded-md shadow-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
            {...register("assessment_preference")}
          >
            <option value="">Selecione...</option>
            {ASSESSMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Existing Materials Summary */}
      <div className="space-y-2">
        <Label htmlFor="existing_materials_summary">
          Resumo de Materiais Existentes (opcional)
        </Label>
        <Textarea
          id="existing_materials_summary"
          rows={2}
          placeholder="Descreva brevemente os materiais que já existem sobre este tema"
          {...register("existing_materials_summary")}
        />
      </div>

      {/* Course Selector for Path B */}
      <div className="space-y-2">
        <Label>Recriar Curso Existente (Caminho B)</Label>
        <p className="text-xs text-text-muted">
          Selecione um curso existente para o Auditor analisar e pré-preencher o wizard
        </p>
        <CourseSelector />
      </div>
    </div>
  )
}
