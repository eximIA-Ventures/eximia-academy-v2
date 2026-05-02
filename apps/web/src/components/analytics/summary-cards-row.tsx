"use client"

import { StatCard } from "@eximia/ui"
import { Activity, Brain, Eye, Layers } from "lucide-react"
import type { AggregateSummary } from "@/types/analytics"

interface SummaryCardsRowProps {
  summary: AggregateSummary
}

export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<Activity size={20} />}
        label="Sessões Ativas"
        value={summary.totalSessions}
      />
      <StatCard
        icon={<Layers size={20} />}
        label="Profundidade Média"
        value={`${summary.avgDepth}/7`}
        trend={
          summary.deltaDepth != null
            ? summary.deltaDepth > 0
              ? "up"
              : summary.deltaDepth < 0
                ? "down"
                : "neutral"
            : undefined
        }
        trendValue={
          summary.deltaDepth != null
            ? `${summary.deltaDepth > 0 ? "+" : ""}${summary.deltaDepth}`
            : undefined
        }
      />
      <StatCard
        icon={<Brain size={20} />}
        label="Breakthroughs/Sessão"
        value={summary.avgBreakthroughsPerSession}
        trend={
          summary.deltaBreakthroughs != null
            ? summary.deltaBreakthroughs > 0
              ? "up"
              : summary.deltaBreakthroughs < 0
                ? "down"
                : "neutral"
            : undefined
        }
        trendValue={
          summary.deltaBreakthroughs != null
            ? `${summary.deltaBreakthroughs > 0 ? "+" : ""}${summary.deltaBreakthroughs}`
            : undefined
        }
      />
      <StatCard
        icon={<Eye size={20} />}
        label="Detecção IA"
        value={`${summary.aiDetectionRate}%`}
      />
    </div>
  )
}
