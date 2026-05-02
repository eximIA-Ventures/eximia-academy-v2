"use client"

import { useState } from "react"
import { Badge, cn } from "@eximia/ui"
import { ChevronDown, Clock, Brain, BookOpen } from "lucide-react"
import { FrameworkStageBar } from "./framework-stage-bar"

interface ModuleObjective {
  objectiveId: string
  bloomLevel: string
  objectiveStatement: string
}

interface ModuleData {
  id: string
  order: number
  title: string
  description: string | null
  durationMinutes: number | null
  interactionType: string | null
  frameworkStages: Array<{ stage: string; label?: string; durationMinutes?: number }>
  cognitiveLoad: { chunkSize?: number; level?: string } | null
  objectives: ModuleObjective[]
}

interface ModuleCardProps {
  module: ModuleData
  framework: string
}

const INTERACTION_LABELS: Record<string, string> = {
  socratic_dialogue: "Diálogo Pedagógico",
  guided_practice: "Prática Guiada",
  case_study: "Estudo de Caso",
  problem_based: "Baseado em Problemas",
  collaborative: "Colaborativo",
  self_directed: "Autodirigido",
  quiz: "Quiz",
  scenario: "Cenário",
  assignment: "Atividade",
}

export function ModuleCard({ module, framework }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card transition-colors hover:border-border-medium">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-label={`Módulo ${module.order}: ${module.title}${expanded ? " — recolher" : " — expandir"}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-blue-mid/10 text-sm font-bold text-accent-blue-mid">
          {module.order}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-primary">
            {module.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {module.durationMinutes && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Clock className="h-3 w-3" />
                {module.durationMinutes} min
              </span>
            )}
            {module.interactionType && (
              <Badge variant="info" className="text-[10px]">
                {INTERACTION_LABELS[module.interactionType] ||
                  module.interactionType}
              </Badge>
            )}
            {module.cognitiveLoad?.level && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Brain className="h-3 w-3" />
                {module.cognitiveLoad.level}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-muted transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-4 border-t border-border-subtle px-4 py-3">
          {module.description && (
            <p className="text-sm text-text-secondary">{module.description}</p>
          )}

          {/* Framework Stage Bar */}
          {module.frameworkStages.length > 0 && (
            <FrameworkStageBar
              stages={module.frameworkStages}
              framework={framework}
            />
          )}

          {/* Objectives */}
          {module.objectives.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <BookOpen className="h-3.5 w-3.5" />
                Objetivos de Aprendizagem
              </p>
              <div className="space-y-1.5">
                {module.objectives.map((obj) => (
                  <div
                    key={obj.objectiveId}
                    className="flex items-start gap-2 rounded-md bg-bg-elevated px-3 py-2"
                  >
                    <Badge
                      variant="default"
                      className="shrink-0 text-[10px]"
                    >
                      {obj.bloomLevel}
                    </Badge>
                    <p className="text-xs text-text-primary">
                      {obj.objectiveStatement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
