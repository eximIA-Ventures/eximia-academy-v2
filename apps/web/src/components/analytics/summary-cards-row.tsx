"use client"

import { Activity, Brain, HelpCircle, Layers, TrendingUp } from "lucide-react"
import { useState } from "react"
import type { AggregateSummary } from "@/types/analytics"

interface SummaryCardsRowProps {
  summary: AggregateSummary
}

interface CardData {
  icon: typeof Activity
  label: string
  value: string | number
  help: string
  delta?: number | null
}

function StatCardWithHelp({ icon: Icon, label, value, help, delta }: CardData) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="relative rounded-2xl bg-white dark:bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <div className="flex items-start justify-between mb-2">
        <Icon size={18} className="text-text-muted" />
        <button type="button" onClick={() => setShowHelp(!showHelp)} className="text-text-muted hover:text-cerrado-600 transition-colors">
          <HelpCircle size={13} />
        </button>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
        {delta !== null && delta !== undefined && (
          <span className={`text-[10px] font-semibold ${delta >= 0 ? "text-semantic-success" : "text-semantic-error"}`}>
            {delta >= 0 ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
      {showHelp && (
        <div className="absolute inset-x-0 top-full mt-1 mx-2 z-10 rounded-xl bg-white dark:bg-bg-card border border-gray-100 dark:border-white/10 shadow-lg p-3">
          <p className="text-[11px] text-text-secondary leading-relaxed">{help}</p>
        </div>
      )}
    </div>
  )
}

export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  const cards: CardData[] = [
    {
      icon: Activity,
      label: "Sessões Ativas",
      value: summary.totalSessions,
      delta: summary.deltaSessions,
      help: "Total de sessões no período. O delta mostra variação vs período anterior (ex: 30d atual vs 30d anterior).",
    },
    {
      icon: TrendingUp,
      label: "Taxa de Engajamento",
      value: `${summary.engagementRate ?? 0}%`,
      help: "Calculado como: (sessões concluídas + reflexões escritas) ÷ (total de alunos × (capítulos + slides)). Mede quanto do potencial total de interação foi realizado.",
    },
    {
      icon: Layers,
      label: "Profundidade Média",
      value: `${summary.avgDepth}/7`,
      delta: summary.deltaDepth !== null ? Math.round(summary.deltaDepth * 100 / Math.max(summary.avgDepth, 1)) : null,
      help: "Nível médio de raciocínio (escala 1-7). O delta mostra variação vs período anterior.",
    },
    {
      icon: Brain,
      label: "Breakthroughs/Sessão",
      value: summary.avgBreakthroughsPerSession,
      help: "Média de momentos de 'eureka' por sessão — quando o aluno demonstra um salto de compreensão significativo. Detectado pela IA durante a conversa socrática.",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCardWithHelp key={card.label} {...card} />
      ))}
    </div>
  )
}
