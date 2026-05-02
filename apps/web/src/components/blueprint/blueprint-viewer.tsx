/**
 * Blueprint Viewer Component
 * Display generated blueprint objectives and assessments
 */

"use client"

import { Blueprint, LearningObjective, Assessment } from "@/types/blueprint"
import { Card, CardContent, CardHeader } from "@eximia/ui"

interface BlueprintViewerProps {
  blueprint: Blueprint
}

export function BlueprintViewer({ blueprint }: BlueprintViewerProps) {
  const { summary, blueprint: blueprintData } = blueprint

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">{summary.total_modules} Modules</h2>
          <p className="text-sm text-text-muted">
            Framework: {summary.framework}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-2xl font-bold">{summary.total_objectives}</p>
              <p className="text-sm text-text-muted">Objectives</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.total_assessments}</p>
              <p className="text-sm text-text-muted">Assessments</p>
            </div>
            <div>
              <p className="text-sm font-mono text-text-muted">
                {summary.bloom_progression.join(" → ")}
              </p>
              <p className="text-xs text-text-muted">Bloom Progression</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objectives */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">Learning Objectives</h3>
        {blueprintData.objectives.map((obj, idx) => (
          <ObjectiveCard key={obj.objective_id} objective={obj} index={idx + 1} />
        ))}
      </div>

      {/* Assessments */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">Assessments</h3>
        {blueprintData.assessments.map((assessment, idx) => (
          <AssessmentCard
            key={`${assessment.objective_id}-${idx}`}
            assessment={assessment}
            index={idx + 1}
          />
        ))}
      </div>
    </div>
  )
}

function ObjectiveCard({
  objective,
  index,
}: {
  objective: LearningObjective
  index: number
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue-mid/20">
            <span className="text-sm font-bold text-accent-blue-light">{index}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-text-primary">Module {objective.module_number}</h4>
              <span className="rounded-full bg-accent-gold/15 px-2 py-1 text-xs font-medium text-accent-gold">
                {objective.bloom_level}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {objective.objective_statement}
            </p>
            <div className="mt-3 grid gap-2 text-xs text-text-muted md:grid-cols-2">
              <div>
                <p className="font-medium">Behavior:</p>
                <p>{objective.abcd.behavior}</p>
              </div>
              <div>
                <p className="font-medium">Condition:</p>
                <p>{objective.abcd.condition}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AssessmentCard({
  assessment,
  index,
}: {
  assessment: Assessment
  index: number
}) {
  return (
    <Card className="border-l-4 border-l-semantic-success">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-semantic-success/20">
            <span className="text-sm font-bold text-semantic-success">{index}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-text-primary">{assessment.assessment_type}</h4>
              <span className="text-xs font-medium text-text-muted">
                {assessment.timing}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              For: {assessment.objective_id}
            </p>
            <div className="mt-2 flex gap-4 text-xs text-text-muted">
              <p>Format: {assessment.format}</p>
              <p>Duration: {assessment.estimated_duration_min}m</p>
              {assessment.rubric_required && (
                <p className="font-medium text-amber-600">📋 Rubric Required</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
