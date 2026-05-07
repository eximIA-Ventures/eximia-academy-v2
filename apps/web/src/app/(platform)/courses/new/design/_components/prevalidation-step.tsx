"use client"

import { useFormContext } from "react-hook-form"
import { Button } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import {
  calculateBriefScore,
  getBriefScoreRating,
  validateBrief,
} from "@eximia/course-designer"
import { Sparkles, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { BriefScoreIndicator } from "./brief-score-indicator"

interface PrevalidationStepProps {
  onGenerate: () => void
}

export function PrevalidationStep({ onGenerate }: PrevalidationStepProps) {
  const { getValues } = useFormContext<CourseDesignerInput>()
  const values = getValues()

  const score = calculateBriefScore(values)
  const rating = getBriefScoreRating(score)
  const validation = validateBrief(values)

  const canGenerate = validation.valid || score >= 50

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          6. Revisão & Geração
        </h2>
        <p className="text-sm text-text-secondary">
          Revise a qualidade do brief antes de gerar o blueprint
        </p>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center gap-4 rounded-lg shadow-card bg-bg-surface p-6">
        <BriefScoreIndicator score={score} rating={rating} />
        <p className="text-center text-sm text-text-secondary">
          {score >= 90
            ? "Brief excelente! Todos os campos otimizados."
            : score >= 70
              ? "Brief completo. Bom para gerar blueprint de alta qualidade."
              : score >= 50
                ? "Brief suficiente. Preencha mais campos para melhorar o resultado."
                : "Brief incompleto. Complete os campos obrigatórios para gerar."}
        </p>
      </div>

      {/* Validation Checks */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-primary">
          Checklist de Validação
        </p>
        <div className="space-y-1.5">
          {validation.errors.length > 0 &&
            validation.errors.map((err, i) => (
              <div
                key={`err-${i}`}
                className="flex items-center gap-2 rounded-md bg-semantic-error/10 px-3 py-2 text-sm text-semantic-error"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                {err}
              </div>
            ))}
          {validation.warnings.length > 0 &&
            validation.warnings.map((warn, i) => (
              <div
                key={`warn-${i}`}
                className="flex items-center gap-2 rounded-md bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {warn}
              </div>
            ))}
          {validation.errors.length === 0 && (
            <div className="flex items-center gap-2 rounded-md bg-semantic-success/10 px-3 py-2 text-sm text-semantic-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Todos os campos obrigatórios preenchidos
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg shadow-card bg-bg-elevated p-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          Resumo do Brief
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Curso</dt>
            <dd className="text-text-primary">
              {values.course_title || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Duração</dt>
            <dd className="text-text-primary">
              {values.total_duration_hours
                ? `${values.total_duration_hours}h`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Audiência</dt>
            <dd className="text-text-primary">
              {values.target_audience?.role || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Framework</dt>
            <dd className="text-text-primary">
              {values.framework === "auto"
                ? "Auto-Select"
                : values.framework?.toUpperCase() || "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center pt-2">
        <Button
          size="lg"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="gap-2"
        >
          <Sparkles className="h-5 w-5" />
          Gerar Blueprint
        </Button>
      </div>
      {!canGenerate && (
        <p className="text-center text-xs text-semantic-error">
          Corrija os erros acima antes de gerar
        </p>
      )}
    </div>
  )
}
