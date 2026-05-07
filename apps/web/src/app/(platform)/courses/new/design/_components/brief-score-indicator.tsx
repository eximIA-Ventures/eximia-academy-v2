"use client"

import { cn } from "@eximia/ui"

interface BriefScoreIndicatorProps {
  score: number
  rating: string
  size?: "sm" | "md"
}

export function BriefScoreIndicator({
  score,
  rating,
  size = "md",
}: BriefScoreIndicatorProps) {
  const radius = size === "md" ? 40 : 28
  const strokeWidth = size === "md" ? 6 : 4
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const svgSize = (radius + strokeWidth) * 2

  const color =
    score >= 90
      ? "text-semantic-success"
      : score >= 70
        ? "text-cerrado-600"
        : score >= 50
          ? "text-semantic-warning"
          : "text-semantic-error"

  const strokeColor =
    score >= 90
      ? "stroke-semantic-success"
      : score >= 70
        ? "stroke-cerrado-600"
        : score >= 50
          ? "stroke-semantic-warning"
          : "stroke-semantic-error"

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
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
          className={cn("transition-all duration-700", strokeColor)}
        />
      </svg>
      <span
        className={cn(
          "font-bold",
          color,
          size === "md" ? "text-2xl" : "text-lg",
        )}
      >
        {score}
      </span>
      <span className="text-xs text-text-muted">{rating}</span>
    </div>
  )
}
