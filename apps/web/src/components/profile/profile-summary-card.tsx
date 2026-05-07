"use client"

import { Badge, Card, CardContent } from "@eximia/ui"

interface ProfileSummaryCardProps {
  summary: string
  confidence: number
  sessionsAnalyzed: number
  lastUpdated: string
}

function getConfidenceLabel(confidence: number): {
  label: string
  variant: "draft" | "warning" | "info" | "success"
} {
  if (confidence < 0.3) return { label: "Conhecendo você...", variant: "draft" }
  if (confidence < 0.6) return { label: "Perfil em formacao", variant: "warning" }
  if (confidence < 0.8) return { label: "Perfil consistente", variant: "info" }
  return { label: "Perfil consolidado", variant: "success" }
}

export function ProfileSummaryCard({
  summary,
  confidence,
  sessionsAnalyzed,
  lastUpdated,
}: ProfileSummaryCardProps) {
  const percent = Math.round(confidence * 100)
  const { label, variant } = getConfidenceLabel(confidence)
  const formattedDate = new Date(lastUpdated).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-text-secondary">{summary}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant={variant}>{label}</Badge>
            <span className="text-xs text-text-muted">{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-cerrado-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Baseado em {sessionsAnalyzed} {sessionsAnalyzed === 1 ? "sessao" : "sessoes"}
          </span>
          <span>Atualizado em {formattedDate}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export { getConfidenceLabel }
