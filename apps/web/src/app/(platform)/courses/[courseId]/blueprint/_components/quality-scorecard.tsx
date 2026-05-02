"use client"

import { cn } from "@eximia/ui"

interface QualityScorecardProps {
  qualityScore: number | null
  neuroscienceScore: number | null
  qualityVerdict: "approved" | "needs_review" | "rejected" | null
}

function GaugeRing({
  value,
  label,
  weight,
}: {
  value: number
  label: string
  weight: string
}) {
  const radius = 32
  const strokeWidth = 5
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const svgSize = (radius + strokeWidth) * 2

  const color =
    value >= 80
      ? "stroke-semantic-success"
      : value >= 60
        ? "stroke-accent-blue-mid"
        : value >= 40
          ? "stroke-semantic-warning"
          : "stroke-semantic-error"

  const textColor =
    value >= 80
      ? "text-semantic-success"
      : value >= 60
        ? "text-accent-blue-mid"
        : value >= 40
          ? "text-semantic-warning"
          : "text-semantic-error"

  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${value.toFixed(0)} de 100 (peso ${weight})`}>
      <svg width={svgSize} height={svgSize} className="-rotate-90" aria-hidden="true">
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-bg-elevated"
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700", color)}
        />
      </svg>
      <span className={cn("text-lg font-bold", textColor)}>
        {value.toFixed(0)}
      </span>
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-[10px] text-text-muted">{weight}</span>
    </div>
  )
}

export function QualityScorecard({
  qualityScore,
  neuroscienceScore,
  qualityVerdict,
}: QualityScorecardProps) {
  const framework = qualityScore ?? 0
  const neuro = neuroscienceScore ?? 0
  const final = framework * 0.7 + neuro * 0.3

  const verdictLabel =
    qualityVerdict === "approved"
      ? "Aprovado"
      : qualityVerdict === "needs_review"
        ? "Revisão Necessária"
        : qualityVerdict === "rejected"
          ? "Rejeitado"
          : "—"

  const verdictColor =
    qualityVerdict === "approved"
      ? "text-semantic-success bg-semantic-success/10"
      : qualityVerdict === "needs_review"
        ? "text-semantic-warning bg-semantic-warning/10"
        : qualityVerdict === "rejected"
          ? "text-semantic-error bg-semantic-error/10"
          : "text-text-muted bg-bg-elevated"

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Quality Scorecard
        </h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            verdictColor,
          )}
        >
          {verdictLabel}
        </span>
      </div>

      <div className="flex items-center justify-around" role="group" aria-label="Scores de qualidade">
        <GaugeRing value={framework} label="Framework" weight="70%" />
        <GaugeRing value={neuro} label="Neurociência" weight="30%" />
        <div className="flex flex-col items-center gap-1" role="meter" aria-valuenow={Math.round(final)} aria-valuemin={0} aria-valuemax={100} aria-label={`Score final: ${final.toFixed(0)} de 100`}>
          <span className="text-3xl font-bold text-text-primary">
            {final.toFixed(0)}
          </span>
          <span className="text-xs text-text-muted">Score Final</span>
        </div>
      </div>
    </div>
  )
}
