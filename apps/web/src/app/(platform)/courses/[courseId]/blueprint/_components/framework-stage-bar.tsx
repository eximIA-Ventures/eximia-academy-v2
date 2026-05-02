"use client"

import { cn } from "@eximia/ui"

interface FrameworkStage {
  stage: string
  label?: string
  durationMinutes?: number
}

interface FrameworkStageBarProps {
  stages: FrameworkStage[]
  framework: string
}

const STAGE_COLORS = [
  "bg-accent-blue-mid",
  "bg-accent-teal",
  "bg-accent-purple",
  "bg-accent-orange",
  "bg-semantic-success",
  "bg-semantic-warning",
]

export function FrameworkStageBar({
  stages,
  framework,
}: FrameworkStageBarProps) {
  if (!stages.length) return null

  const totalDuration = stages.reduce(
    (sum, s) => sum + (s.durationMinutes || 1),
    0,
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">
          {framework.toUpperCase()}
        </span>
        <span className="text-[10px] text-text-muted">
          {totalDuration} min
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-bg-elevated" role="group" aria-label={`Distribuição de stages do framework ${framework}`}>
        {stages.map((stage, idx) => {
          const width = ((stage.durationMinutes || 1) / totalDuration) * 100
          return (
            <div
              key={idx}
              role="meter"
              aria-valuenow={Math.round(width)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${stage.label || stage.stage}: ${stage.durationMinutes || 0} min (${Math.round(width)}%)`}
              className={cn(
                "h-full transition-all",
                STAGE_COLORS[idx % STAGE_COLORS.length],
              )}
              style={{ width: `${width}%` }}
              title={`${stage.label || stage.stage} — ${stage.durationMinutes || 0}min`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {stages.map((stage, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                STAGE_COLORS[idx % STAGE_COLORS.length],
              )}
            />
            <span className="text-[10px] text-text-muted">
              {stage.label || stage.stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
