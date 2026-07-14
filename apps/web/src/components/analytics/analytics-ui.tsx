"use client"

// ---------------------------------------------------------------------------
// analytics-ui — Apple-like presentation primitives for the manager Analytics
// redesign (docs/redesign/analytics-apple/03-redesenho-spec.md §8).
//
// Design rules baked in here (so callers can't re-introduce the old problems):
//   • ONE action color: `cerrado-600` appears ONLY on interactive elements
//     (CTA, active tab, active toggle, focus). Never on a static number.
//   • Status color (semantic-success/error/warning) ONLY on real risk/trend.
//   • Hierarchy is weight + position, not font-size alone.
//   • Every primitive reuses existing theme.css tokens — zero new hex.
// ---------------------------------------------------------------------------

import { ChevronDown, Search, Sparkles, TrendingDown, TrendingUp, X } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import type { Insight } from "./ai-insights-box"

// ---------------------------------------------------------------------------
// TrendBadge — arrow + % delta. success (up) / error (down) / muted (flat).
// NEVER uses the action color (spec §8: "nunca `cerrado`").
// ---------------------------------------------------------------------------

export function TrendBadge({
  delta,
  suffix = "%",
}: {
  delta?: number | null
  suffix?: string
}) {
  if (delta === null || delta === undefined) return null
  const up = delta > 0
  const down = delta < 0
  const Icon = up ? TrendingUp : down ? TrendingDown : null
  const color = up ? "text-semantic-success" : down ? "text-semantic-error" : "text-text-muted"
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${color}`}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {up ? "+" : ""}
      {delta}
      {suffix}
    </span>
  )
}

// ---------------------------------------------------------------------------
// HeroStat — the Tier-1 "answer to the tab's one question" card.
// H2 question (quiet) → Display number (loud) → up to 3 supporting stats.
// ---------------------------------------------------------------------------

export interface HeroSecondaryStat {
  label: string
  value: string | number
  unit?: string
}

export function HeroStat({
  question,
  value,
  unit,
  delta,
  approximate = false,
  secondary = [],
  children,
}: {
  question: string
  value: string | number
  unit?: string
  delta?: number | null
  /** spec §6.1 — mark a number with a known accuracy caveat as ~aproximado, visibly. */
  approximate?: boolean
  secondary?: HeroSecondaryStat[]
  children?: ReactNode
}) {
  return (
    <section className="rounded-2xl bg-bg-card p-8 sm:p-10 shadow-elevation-1 border border-border-subtle">
      <p className="font-display text-lg font-semibold text-text-muted">{question}</p>
      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <span
          className="font-display font-bold text-text-primary tabular-nums leading-none"
          style={{ fontSize: "clamp(2.75rem, 5vw, 4.5rem)" }}
        >
          {value}
          {unit && <span className="ml-1 text-2xl font-semibold text-text-muted">{unit}</span>}
        </span>
        <TrendBadge delta={delta} />
        {approximate && (
          <span
            className="text-xs text-text-muted/70 pb-2"
            title="Total sujeito a sobreposição entre unidades"
          >
            ~aproximado
          </span>
        )}
      </div>
      {secondary.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-border-subtle pt-5">
          {secondary.map((s) => (
            <div key={s.label}>
              <p className="font-display text-2xl font-semibold text-text-primary tabular-nums">
                {s.value}
                {s.unit && (
                  <span className="ml-0.5 text-sm font-medium text-text-muted">{s.unit}</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// StatRow — inline "128 alunos · 64 ativos (7d) · 12 nunca acessaram".
// Tier 3, no card, no accent color (spec §5).
// ---------------------------------------------------------------------------

export function StatRow({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
      {items.map((it, i) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span className="text-text-muted/50" aria-hidden="true">
              ·
            </span>
          )}
          <span>
            <span className="font-semibold text-text-primary tabular-nums">{it.value}</span>{" "}
            {it.label}
          </span>
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// ToggleGroup — discreet segmented control (Funil/Engajamento, Distribuição/Evolução).
// Active item is the ONLY place the action surface shows up here.
// ---------------------------------------------------------------------------

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg bg-bg-elevated p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? "bg-bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accordion — progressive disclosure. Closed by default, quiet (Tier 3).
// Chevron rotates; body reveals with a spring via grid-rows 0fr→1fr.
// ---------------------------------------------------------------------------

export function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  /** Optional node rendered on the right of the header (e.g. a ToggleGroup). */
  right?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-elevated/50"
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-text-primary">{title}</span>
            {subtitle && <span className="block text-xs text-text-muted">{subtitle}</span>}
          </span>
        </button>
        {open && right && <div className="pr-4">{right}</div>}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-spring)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActionInsightCard — "O que fazer agora". Merges the old AiInsightsBox +
// NextBestAction into one Tier-2 card: up to 3 rule insights by severity,
// "ver mais" for the rest, and ONE cerrado CTA that fetches AI insights.
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Insight["type"], number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
}

const DOT_COLOR: Record<Insight["type"], string> = {
  critical: "bg-semantic-error",
  warning: "bg-semantic-warning",
  positive: "bg-semantic-success",
  info: "bg-text-muted",
}

export function ActionInsightCard({
  insights,
  aiTab,
  aiMetrics,
}: {
  insights: Insight[]
  aiTab?: "uso" | "aprendizagem"
  aiMetrics?: Record<string, unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset stale AI results when the underlying metrics change (period/area switch).
  const metricsKey = JSON.stringify(aiMetrics ?? null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: metricsKey is the change signal.
  useEffect(() => {
    setAiInsights(null)
    setExpanded(false)
  }, [metricsKey])

  const source = aiInsights ?? insights
  const sorted = useMemo(
    () => [...source].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]),
    [source],
  )

  async function fetchAi() {
    if (!aiTab || !aiMetrics) return
    setLoading(true)
    try {
      const res = await fetch("/api/analytics/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: aiTab, metrics: aiMetrics }),
      })
      const data = await res.json()
      if (data.insights?.length > 0) setAiInsights(data.insights)
    } catch {
      /* deterministic insights stay on screen */
    }
    setLoading(false)
  }

  if (sorted.length === 0 && !aiMetrics) return null

  const visible = expanded ? sorted : sorted.slice(0, 3)
  const hidden = sorted.length - visible.length

  return (
    <section className="rounded-xl bg-bg-card p-6 shadow-elevation-2 border border-border-subtle space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          O que fazer agora
        </h3>
        {aiInsights && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-cerrado-600">
            <Sparkles size={12} aria-hidden="true" /> por IA
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma ação recomendada no momento.</p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((insight) => (
            <li key={`${insight.type}-${insight.text}`} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[insight.type]}`}
                aria-hidden="true"
              />
              <span className="text-sm leading-relaxed text-text-secondary">{insight.text}</span>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
        >
          Ver mais {hidden} {hidden === 1 ? "recomendação" : "recomendações"}
        </button>
      )}

      {aiTab && aiMetrics && (
        <div className="pt-1">
          <button
            type="button"
            onClick={fetchAi}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-cerrado-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-cerrado-700 disabled:opacity-50"
          >
            <Sparkles size={14} aria-hidden="true" />
            {loading ? "Analisando…" : aiInsights ? "Reanalisar com IA" : "Aprofundar com IA"}
          </button>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// ScopeBar — one unified strip for every "what am I looking at" control
// (spec §2.6). Tier 3 surface, all controls in a single flex-wrap row.
// ---------------------------------------------------------------------------

export function ScopeBar({
  children,
  onOpenGlossary,
}: {
  children: ReactNode
  onOpenGlossary?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-bg-elevated p-3">
      {children}
      {onOpenGlossary && (
        <button
          type="button"
          onClick={onOpenGlossary}
          aria-haspopup="dialog"
          title="Glossário de métricas"
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-sm font-semibold text-text-muted transition-colors hover:border-cerrado-600 hover:text-cerrado-600"
        >
          ?
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GlossaryDrawer — single global glossary (spec §2.7), replacing the 6+
// per-card HelpCircle tooltips. Slides from the right, has search.
// ---------------------------------------------------------------------------

export interface GlossaryTerm {
  term: string
  definition: string
}

export const ANALYTICS_GLOSSARY: GlossaryTerm[] = [
  {
    term: "Ativos (30d)",
    definition: "Alunos com ao menos uma atividade nos últimos 30 dias, sobre o total da unidade.",
  },
  {
    term: "Conclusão",
    definition: "Percentual de sessões concluídas sobre o total de sessões iniciadas no período.",
  },
  {
    term: "Sessões por aluno",
    definition: "Média de sessões realizadas por aluno no período — mede intensidade de uso.",
  },
  {
    term: "Taxa de Engajamento",
    definition:
      "(sessões concluídas + reflexões escritas) ÷ (sessões potenciais + reflexões potenciais). Quanto do potencial de interação foi realizado.",
  },
  {
    term: "Índice de Reflexões",
    definition:
      "Reflexões escritas ÷ reflexões potenciais (blocos de reflexão nos slides do currículo).",
  },
  {
    term: "Índice Socrático",
    definition:
      "Interações socráticas realizadas ÷ potencial socrático (questões ativas nos módulos socráticos).",
  },
  {
    term: "Profundidade média",
    definition:
      "Nível médio de raciocínio na escala 1–7 (repetição → questionamento crítico), detectado pela IA na conversa.",
  },
  {
    term: "Breakthroughs por sessão",
    definition:
      "Média de saltos de compreensão ('eureka') por sessão, detectados pela IA durante o diálogo socrático.",
  },
  {
    term: "Extensão das reflexões",
    definition:
      "Média de palavras por reflexão — mede quão elaboradas são as respostas, não o nível cognitivo.",
  },
  {
    term: "Risco do aluno",
    definition: "Classificação de saúde: No ritmo, Atenção, Inativo (14+ dias) ou Nunca acessou.",
  },
]

export function GlossaryDrawer({
  open,
  onClose,
  terms = ANALYTICS_GLOSSARY,
}: {
  open: boolean
  onClose: () => void
  terms?: GlossaryTerm[]
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return terms
    return terms.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q),
    )
  }, [query, terms])

  return (
    <>
      {/* backdrop */}
      <button
        type="button"
        aria-label="Fechar glossário"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-bg-card shadow-hero transition-transform duration-300 ease-[var(--ease-spring)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <p className="font-display text-lg font-semibold text-text-primary">Glossário</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-border-subtle px-5 py-3">
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar termo…"
              className="w-full rounded-lg bg-bg-elevated py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cerrado-600/40"
            />
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum termo encontrado.</p>
          ) : (
            filtered.map((t) => (
              <div key={t.term}>
                <p className="text-sm font-semibold text-text-primary">{t.term}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{t.definition}</p>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
