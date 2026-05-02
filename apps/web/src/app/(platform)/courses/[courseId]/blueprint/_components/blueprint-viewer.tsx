"use client"

import { Badge, Button } from "@eximia/ui"
import {
  Clock,
  Users,
  BookOpen,
  ClipboardCheck,
  ArrowLeft,
  Download,
} from "lucide-react"
import Link from "next/link"
import { QualityScorecard } from "./quality-scorecard"
import { BloomProgression } from "./bloom-progression"
import { ModuleCard } from "./module-card"
import { KirkpatrickSummary } from "./kirkpatrick-summary"

interface BlueprintModule {
  id: string
  order: number
  title: string
  description: string | null
  durationMinutes: number | null
  interactionType: string | null
  frameworkStages: Array<{
    stage: string
    label?: string
    durationMinutes?: number
  }>
  cognitiveLoad: { chunkSize?: number; level?: string } | null
  objectives: Array<{
    objectiveId: string
    bloomLevel: string
    objectiveStatement: string
  }>
}

interface BlueprintAssessment {
  id: string
  objectiveId: string
  assessmentType: string
  timing: string
  format: string | null
  kirkpatrickLevel: number | null
}

interface BlueprintData {
  id: string
  courseId: string | null
  status: string
  framework: string
  primaryFramework: string | null
  qualityScore: number | null
  neuroscienceScore: number | null
  qualityVerdict: "approved" | "needs_review" | "rejected" | null
  bloomProgression: string[] | null
  totalObjectives: number
  totalAssessments: number
  interactionStrategy: string | null
  audienceProfile: Record<string, unknown> | null
  generatedAt: string | null
  version: string | null
  modules: BlueprintModule[]
  assessments: BlueprintAssessment[]
}

interface BlueprintViewerProps {
  blueprint: BlueprintData
  courseTitle: string
}

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  generating: { label: "Gerando", variant: "bg-semantic-warning/10 text-semantic-warning" },
  draft: { label: "Rascunho", variant: "bg-accent-blue-mid/10 text-accent-blue-mid" },
  approved: { label: "Aprovado", variant: "bg-semantic-success/10 text-semantic-success" },
  applied: { label: "Aplicado", variant: "bg-accent-purple/10 text-accent-purple" },
  archived: { label: "Arquivado", variant: "bg-bg-elevated text-text-muted" },
}

export function BlueprintViewer({
  blueprint,
  courseTitle,
}: BlueprintViewerProps) {
  const status = STATUS_MAP[blueprint.status] || STATUS_MAP.draft
  const framework =
    blueprint.primaryFramework || blueprint.framework || "auto"
  const totalDuration = blueprint.modules.reduce(
    (sum, m) => sum + (m.durationMinutes || 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/courses"
            className="mb-2 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para Cursos
          </Link>
          <h1 className="text-xl font-bold text-text-primary">{courseTitle}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.variant}`}
            >
              {status.label}
            </span>
            <span className="text-xs text-text-muted">
              v{blueprint.version || "3.0"}
            </span>
            {blueprint.generatedAt && (
              <span className="text-xs text-text-muted">
                Gerado em{" "}
                {new Date(blueprint.generatedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Exportar
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-3">
          <div className="flex items-center gap-2 text-text-muted">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Duração</span>
          </div>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {totalDuration > 0 ? `${Math.round(totalDuration / 60)}h` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-3">
          <div className="flex items-center gap-2 text-text-muted">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs">Módulos</span>
          </div>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {blueprint.modules.length}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-3">
          <div className="flex items-center gap-2 text-text-muted">
            <Users className="h-4 w-4" />
            <span className="text-xs">Objetivos</span>
          </div>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {blueprint.totalObjectives}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-card p-3">
          <div className="flex items-center gap-2 text-text-muted">
            <ClipboardCheck className="h-4 w-4" />
            <span className="text-xs">Avaliações</span>
          </div>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {blueprint.totalAssessments}
          </p>
        </div>
      </div>

      {/* Quality + Bloom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <QualityScorecard
          qualityScore={blueprint.qualityScore}
          neuroscienceScore={blueprint.neuroscienceScore}
          qualityVerdict={blueprint.qualityVerdict}
        />
        {blueprint.bloomProgression && blueprint.bloomProgression.length > 0 && (
          <BloomProgression levels={blueprint.bloomProgression} />
        )}
      </div>

      {/* Kirkpatrick */}
      {blueprint.assessments.length > 0 && (
        <KirkpatrickSummary assessments={blueprint.assessments} />
      )}

      {/* Modules List */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">
          Módulos ({blueprint.modules.length})
        </h2>
        {blueprint.modules
          .sort((a, b) => a.order - b.order)
          .map((mod) => (
            <ModuleCard key={mod.id} module={mod} framework={framework} />
          ))}
      </div>
    </div>
  )
}
