"use client"

import { ShieldCheck } from "lucide-react"
import { useState } from "react"

const VERDICT_CONFIG = {
  likely_human: { color: "text-semantic-success", label: "Provavelmente humano" },
  uncertain: { color: "text-accent-gold", label: "Incerto" },
  likely_ai: { color: "text-semantic-error", label: "Provavelmente IA" },
} as const

type Verdict = keyof typeof VERDICT_CONFIG

interface AiDetectionBadgeProps {
  verdict: string
  confidence: string
  enabled: boolean
}

export function AiDetectionBadge({ verdict, confidence, enabled }: AiDetectionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!enabled) return null

  const config = VERDICT_CONFIG[verdict as Verdict] ?? VERDICT_CONFIG.uncertain

  const tooltipId = `ai-badge-tooltip-${verdict}`

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      role="status"
      aria-label={`AI Detection: ${config.label}`}
      aria-describedby={showTooltip ? tooltipId : undefined}
    >
      <ShieldCheck size={16} className={`cursor-help ${config.color}`} aria-hidden="true" />
      {showTooltip && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-elevated px-3 py-2 text-xs shadow-elevated"
        >
          <p className="font-medium text-text-primary">{config.label}</p>
          <p className="text-text-muted">Confianca: {confidence}</p>
        </div>
      )}
    </div>
  )
}
