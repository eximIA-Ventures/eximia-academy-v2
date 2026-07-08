"use client"

// ---------------------------------------------------------------------------
// LearningIndicatorsCard — unified indicator layout for all 3 analytics views.
// Item 2.4: single reusable component for unit / area / individual scopes.
// Item 2.1: "Profundidade Média" and "Breakthroughs/Sessão" are ONLY shown
//           when showDepthAndBreakthroughs=true (Aprendizagem tab).
// Item 2.2: Reflexões and Socrática indicators from aggregate route .indicators.
// Item 2.3: Engajamento revised — stays visible in all views.
// ---------------------------------------------------------------------------

import type {
  AggregateSummary,
  AnalyticsScope,
  ReflectionSocraticIndicators,
} from "@/types/analytics"
import {
  Activity,
  BookOpen,
  Brain,
  HelpCircle,
  Layers,
  MessageSquare,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LearningIndicatorsCardProps {
  summary: AggregateSummary
  /** Narrows display context but doesn't gate cards — use showDepthAndBreakthroughs for that. */
  scope?: AnalyticsScope["kind"]
  /**
   * Item 2.2 — reflection/socrática potentials from /api/analytics/aggregate .indicators.
   * When absent the reflexão/socrática cards render with dashes (graceful).
   */
  indicators?: ReflectionSocraticIndicators
  /**
   * Item 2.1 — set true ONLY in the Aprendizagem tab.
   * Controls whether "Profundidade Média" and "Breakthroughs/Sessão" are shown.
   * Default: false (not shown in "Uso da Plataforma").
   */
  showDepthAndBreakthroughs?: boolean
  /** Optional CSS class override for the grid wrapper. */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CardDef {
  icon: typeof Activity
  label: string
  value: string | number
  help: string
  delta?: number | null
  accentColor?: string
}

function StatCardWithHelp({ icon: Icon, label, value, help, delta, accentColor }: CardDef) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="relative rounded-2xl bg-bg-card p-5 shadow-card dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <div className="flex items-start justify-between mb-2">
        <Icon
          size={18}
          className={accentColor ? undefined : "text-text-muted"}
          style={accentColor ? { color: accentColor } : undefined}
        />
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-text-muted hover:text-cerrado-600 transition-colors"
        >
          <HelpCircle size={13} />
        </button>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
        {delta !== null && delta !== undefined && (
          <span
            className={`text-[10px] font-semibold ${delta >= 0 ? "text-semantic-success" : "text-semantic-error"}`}
          >
            {delta >= 0 ? "↑" : "↓"}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
      {showHelp && (
        <div className="absolute inset-x-0 top-full mt-1 mx-2 z-10 rounded-xl bg-bg-card border border-gray-100 dark:border-white/10 shadow-lg p-3">
          <p className="text-[11px] text-text-secondary leading-relaxed">{help}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LearningIndicatorsCard
// ---------------------------------------------------------------------------

/**
 * Unified indicator card grid for the three analytics views (unit/area/individual).
 *
 * Base cards (always rendered):
 *   • Sessões Ativas         — total sessions + delta vs previous period
 *   • Taxa de Engajamento    — (completed + reflexões) ÷ (session + reflection potential)
 *   • Índice de Reflexões    — reflexões realizadas ÷ reflexões potenciais (item 2.2)
 *   • Índice Socrático       — interações realizadas ÷ potencial socrático (item 2.2)
 *
 * Aprendizagem-only (showDepthAndBreakthroughs=true):
 *   • Profundidade Média     — avg depth 1-7 (item 2.1 — removed from Uso tab)
 *   • Breakthroughs/Sessão   — avg breakthroughs (item 2.1 — removed from Uso tab)
 */
export function LearningIndicatorsCard({
  summary,
  scope = "tenant",
  indicators,
  showDepthAndBreakthroughs = false,
  className,
}: LearningIndicatorsCardProps) {
  // --- Engagement card ---
  const engagementCard: CardDef = {
    icon: TrendingUp,
    label: "Taxa de Engajamento",
    value: `${summary.engagementRate ?? 0}%`,
    help:
      "Calculado como: (sessões concluídas + reflexões escritas) ÷ (sessões potenciais + reflexões potenciais). " +
      "Mede quanto do potencial total de interação foi realizado no período.",
  }

  // --- Sessions card ---
  const sessionsCard: CardDef = {
    icon: Activity,
    label: "Sessões Ativas",
    value: summary.totalSessions,
    delta: summary.deltaSessions,
    help: "Total de sessões no período. O delta mostra variação vs período anterior (ex: 30d atual vs 30d anterior).",
  }

  // --- Item 2.2 — Reflection index ---
  const reflTotal = indicators?.total
  const reflPct = reflTotal?.reflectionIndexPct ?? null
  const reflWritten = reflTotal?.reflectionsWritten ?? null
  const reflPotential = reflTotal?.reflectionPotential ?? null

  const reflectionCard: CardDef = {
    icon: BookOpen,
    label: "Índice de Reflexões",
    value: reflPct !== null ? `${reflPct}%` : "—",
    accentColor: "#059669", // emerald-600
    help: `Reflexões escritas ÷ reflexões potenciais (blocos de reflexão nos slides do currículo). ${
      reflWritten !== null && reflPotential !== null
        ? `No período: ${reflWritten} de ${reflPotential} potenciais.`
        : "Aguardando dados do período."
    }`,
  }

  // --- Item 2.2 — Socratic index ---
  const socPct = reflTotal?.socraticIndexPct ?? null
  const socRealized = reflTotal?.socraticRealized ?? null
  const socPotential = reflTotal?.socraticPotential ?? null

  const socraticCard: CardDef = {
    icon: MessageSquare,
    label: "Índice Socrático",
    value: socPct !== null ? `${socPct}%` : "—",
    accentColor: "#7c3aed", // violet-700
    help: `Interações socráticas realizadas ÷ potencial socrático (questões ativas nos módulos socrátcos). ${
      socRealized !== null && socPotential !== null
        ? `No período: ${socRealized} de ${socPotential} potenciais.`
        : "Aguardando dados do período."
    }`,
  }

  // --- Item 2.1 — Aprendizagem-only cards ---
  const depthDelta =
    summary.deltaDepth !== null
      ? Math.round((summary.deltaDepth * 100) / Math.max(summary.avgDepth, 1))
      : null

  const depthCard: CardDef = {
    icon: Layers,
    label: "Profundidade Média",
    value: `${summary.avgDepth}/7`,
    delta: depthDelta,
    accentColor: "#8b5cf6", // violet-500
    help:
      "Nível médio de raciocínio (escala 1-7). O delta mostra variação vs período anterior. " +
      "Visível na aba Aprendizagem — indicador de qualidade cognitiva, não de volume de uso.",
  }

  const breakthroughCard: CardDef = {
    icon: Brain,
    label: "Breakthroughs/Sessão",
    value: summary.avgBreakthroughsPerSession,
    accentColor: "#d97706", // amber-600
    help:
      "Média de momentos de 'eureka' por sessão — quando o aluno demonstra um salto de compreensão significativo. " +
      "Detectado pela IA durante a conversa socrática. Visível na aba Aprendizagem.",
  }

  // Build the card array in the desired order
  const baseCards: CardDef[] = [sessionsCard, engagementCard, reflectionCard, socraticCard]
  const learningCards: CardDef[] = showDepthAndBreakthroughs
    ? [...baseCards, depthCard, breakthroughCard]
    : baseCards

  // Grid: 2 cols on sm, 4 cols on xl (grows to 6 when learning cards shown)
  const gridClass = showDepthAndBreakthroughs
    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"

  return (
    <div className={className}>
      <div className={gridClass}>
        {learningCards.map((card) => (
          <StatCardWithHelp key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Back-compat alias — existing imports of SummaryCardsRow still work.
// The integrator should migrate call sites to LearningIndicatorsCard over time.
// ---------------------------------------------------------------------------

/** @deprecated Use LearningIndicatorsCard with explicit props instead. */
interface SummaryCardsRowProps {
  summary: AggregateSummary
}

/** @deprecated Backward-compatible wrapper. Use LearningIndicatorsCard directly. */
export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  return <LearningIndicatorsCard summary={summary} showDepthAndBreakthroughs={false} />
}
