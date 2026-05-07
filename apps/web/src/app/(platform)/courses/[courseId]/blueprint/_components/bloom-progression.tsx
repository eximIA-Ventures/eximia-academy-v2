"use client"

import { cn } from "@eximia/ui"

const BLOOM_LEVELS = [
  { id: "remember", label: "Lembrar", color: "bg-red-500/80" },
  { id: "understand", label: "Compreender", color: "bg-orange-500/80" },
  { id: "apply", label: "Aplicar", color: "bg-yellow-500/80" },
  { id: "analyze", label: "Analisar", color: "bg-green-500/80" },
  { id: "evaluate", label: "Avaliar", color: "bg-blue-500/80" },
  { id: "create", label: "Criar", color: "bg-purple-500/80" },
] as const

interface BloomProgressionProps {
  levels: string[]
}

export function BloomProgression({ levels }: BloomProgressionProps) {
  const levelCounts = BLOOM_LEVELS.map((bl) => ({
    ...bl,
    count: levels.filter((l) => l.toLowerCase() === bl.id).length,
  }))

  const maxCount = Math.max(...levelCounts.map((l) => l.count), 1)

  return (
    <div className="rounded-lg shadow-card bg-bg-card p-4" role="figure" aria-label="Gráfico de progressão de Bloom">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        Progressão de Bloom
      </h3>
      <div className="flex items-end gap-2" role="group" aria-label="Distribuição por nível de Bloom">
        {levelCounts.map((level) => (
          <div key={level.id} className="flex flex-1 flex-col items-center gap-1" role="meter" aria-valuenow={level.count} aria-valuemin={0} aria-valuemax={maxCount} aria-label={`${level.label}: ${level.count} módulo${level.count !== 1 ? "s" : ""}`}>
            <span className="text-xs font-medium text-text-primary">
              {level.count}
            </span>
            <div
              className={cn("w-full rounded-t-sm transition-all", level.color)}
              style={{
                height: `${Math.max((level.count / maxCount) * 80, 4)}px`,
              }}
              aria-hidden="true"
            />
            <span className="text-[10px] text-text-muted">{level.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
