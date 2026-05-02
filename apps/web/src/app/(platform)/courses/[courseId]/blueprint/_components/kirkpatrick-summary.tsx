"use client"

import { cn } from "@eximia/ui"

interface KirkpatrickSummaryProps {
  assessments: Array<{
    kirkpatrickLevel: number | null
    assessmentType: string
  }>
}

const KIRKPATRICK_LEVELS = [
  { level: 1, label: "Reação", description: "Satisfação do participante" },
  { level: 2, label: "Aprendizagem", description: "Aquisição de conhecimento" },
  { level: 3, label: "Comportamento", description: "Aplicação no trabalho" },
  { level: 4, label: "Resultados", description: "Impacto organizacional" },
]

export function KirkpatrickSummary({ assessments }: KirkpatrickSummaryProps) {
  const levelCounts = KIRKPATRICK_LEVELS.map((kl) => ({
    ...kl,
    count: assessments.filter((a) => a.kirkpatrickLevel === kl.level).length,
  }))

  const hasData = levelCounts.some((l) => l.count > 0)
  if (!hasData) return null

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        Kirkpatrick — Níveis de Avaliação
      </h3>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Níveis de avaliação Kirkpatrick">
        {levelCounts.map((kl) => (
          <div
            key={kl.level}
            className={cn(
              "flex flex-col items-center rounded-md p-2",
              kl.count > 0
                ? "bg-accent-blue-mid/10"
                : "bg-bg-elevated",
            )}
            role="meter"
            aria-valuenow={kl.count}
            aria-valuemin={0}
            aria-label={`Nível ${kl.level} (${kl.label}): ${kl.count} avaliação${kl.count !== 1 ? "ões" : ""}`}
          >
            <span
              className={cn(
                "text-lg font-bold",
                kl.count > 0 ? "text-accent-blue-mid" : "text-text-muted",
              )}
            >
              {kl.count}
            </span>
            <span className="text-center text-[10px] font-medium text-text-primary">
              N{kl.level}: {kl.label}
            </span>
            <span className="text-center text-[9px] text-text-muted">
              {kl.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
