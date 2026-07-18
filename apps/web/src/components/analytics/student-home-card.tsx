"use client"

// ---------------------------------------------------------------------------
// StudentHomeCard — the student home card (OFFICIAL: the comparison)
// ---------------------------------------------------------------------------
// SH-1.4 + UX rework (Hugo, 2026-07-11). Hugo's definitive call: the "Meu
// progresso" view was a panel addition he never asked for; the COMPARISON
// (Você vs Média) is the official view. So this card now shows the comparison
// as its DEFAULT and ONLY content — no intent toggle, no progress view.
//
//   student-dashboard → StudentComparison (fetch wrapper) → StudentHomeCard
//     ├─ NextStepBar ("Próximo passo / Continuar agora")   — the single CTA
//     └─ comparison card
//          ├─ [Visão detalhada] (default) → ComparisonInsightsTable (Você vs Média)
//          └─ [Gráficos]                  → SignalRowsView (the bars, preserved)
//
// ONE toggle only ([Visão detalhada] [Gráficos]) switches the comparison format;
// it replaces/merges the old Tabela/Barras sub-toggle. The bars survive as the
// "Gráficos" format. The winning cell of each indicator is highlighted inside
// ComparisonInsightsTable (Você OR Média).
//
// NOTE (flagged to Capataz + Lupa): removing the progress view leaves
// StudentProgressHeadline (SH-1.3) UNUSED by the app. It is NOT deleted here —
// only the IndicatorComparisonTable prune was authorized. `buildProgressHeadline`
// is still used to derive the CTA coaching line.
// ---------------------------------------------------------------------------

import { type SummaryTone, buildRitmoSummary, summaryToneOf } from "@/lib/analytics/ritmo-summary"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { Card, CardContent, CardHeader } from "@eximia/ui"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, AlertTriangle, Compass, Minus, TrendingUp } from "lucide-react"
import { useState } from "react"
import { ComparisonInsightsTable } from "./comparison-insights-table"
import { DEFAULT_CONTINUE_HREF, SignalRowsView, buildSignalRows } from "./student-comparison-view"

type CompareView = "table" | "bars"

// Active-pill literal (theme.css --color-cerrado-600). Carried INLINE, per the
// house CSS-STALE IMMUNITY pattern (see student-comparison-view.tsx): the active
// state is critical, and a stale/tree-shaken `bg-cerrado-600` must never leave
// the selected toggle looking unselected. The class stays as progressive
// enhancement; the inline style is the guarantee.
const SEG_ACTIVE_BG = "oklch(0.64 0.17 42)"

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { backgroundColor: SEG_ACTIVE_BG, color: "#ffffff" } : undefined}
      className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors ${
        active
          ? "bg-cerrado-600 text-white"
          : "bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  )
}

export function StudentHomeCard({
  student,
  unit,
  indicators,
  continueHref = DEFAULT_CONTINUE_HREF,
  studentFirstName,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  indicators: StudentHomeIndicators
  continueHref?: string
  /**
   * PONTO 1 (Hugo 2026-07-14) — protagonismo: o PRIMEIRO nome do aluno logado
   * (o mesmo da saudação) vira a label da linha do sujeito: "Eu (Rinaldo)".
   * Opcional: ausente → a linha degrada para "Eu".
   */
  studentFirstName?: string | null
  /**
   * DEPRECATED desde ROUND 18 (Hugo 2026-07-18): antes suprimia a NextStepBar/CTA do
   * painel de resumo. O CTA "Continuar agora" foi REMOVIDO do painel nesta rodada (o CTA
   * por linha da tabela cobre a ação), então este prop virou no-op. Mantido no tipo só
   * para não quebrar call sites que ainda o passam (student-comparison.tsx); pode ser
   * removido numa limpeza futura junto com o call site.
   */
  showNextStep?: boolean
}) {
  const [compareView, setCompareView] = useState<CompareView>("table")

  // Bars power the "Gráficos" format. SH-1.5 R2 (Hugo 2026-07-18): the CTA no
  // longer carries a coaching line ("Próximo passo: ..."), so buildProgressHeadline
  // is no longer needed here — the "Continuar agora" button is a plain link.
  const bars = buildSignalRows(student, unit)

  return (
    <div className="space-y-4" data-testid="student-home-card">
      {/* The comparison — the DEFAULT and ONLY view. Same card finish as the
          manager "Tabela simplificada" (student-insights-table.tsx). */}
      <Card>
        {/* M4 — COMPACT header, single row: title/subtitle (left) · controls
            (right), no dead vertical space before the table. The controls group
            holds only the view toggle (Hugo, 2026-07-14: the decorative
            Buscar/Exportar were removed from the student screen; the real ones
            live in the manager view, student-insights-table.tsx). */}
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-text-primary">Meu ritmo</h2>
              {/* Ajuste fino (Hugo 2026-07-14): subtítulo ENXUTO, só a frase em
                  1ª pessoa. ROUND 18 (Hugo 2026-07-18): trocado para "Como estou na
                  minha jornada" (sem ponto final, conforme a captura). */}
              <p className="mt-1 text-xs text-text-muted">Como estou na minha jornada</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegButton active={compareView === "table"} onClick={() => setCompareView("table")}>
                Visão detalhada
              </SegButton>
              <SegButton active={compareView === "bars"} onClick={() => setCompareView("bars")}>
                Gráficos
              </SegButton>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          {compareView === "table" ? (
            <>
              <ComparisonInsightsTable
                indicators={indicators}
                studentFirstName={studentFirstName}
                continueHref={continueHref}
              />
              {/* SH-1.5 R2 (Hugo 2026-07-18) — the personal, deterministic summary
                  paragraph (pure buildRitmoSummary), only under "Visão detalhada",
                  in a dark, emphasised panel. ROUND 18 (Hugo 2026-07-18): the
                  "Continuar agora" CTA was REMOVED from this panel (it duplicated the
                  per-row CTA that every table row already carries since R4/R6), and a
                  REACTIVE Noodle illustration was added in its place — the glyph reflects
                  the student's OVERALL tone (summaryToneOf, severity-first with a #1
                  celebratory override). */}
              <RitmoSummaryPanel
                summary={buildRitmoSummary(indicators, studentFirstName)}
                tone={summaryToneOf(indicators)}
              />
            </>
          ) : (
            <SignalRowsView bars={bars} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RitmoSummaryPanel — SH-1.5 R2, illustration added in ROUND 18, simplified back
// to an icon in ROUND 19 (Hugo 2026-07-18).
//
// R2 shipped this as a dark panel with the deterministic summary + a "Continuar agora"
// CTA in the corner. Hugo found it "esquisito" and asked to (a) REMOVE the CTA (it
// duplicated the per-row CTA every table row already has since R4/R6) and (b) add a
// REACTIVE visual that changes with the student's performance. Round 18 answered (b)
// with 5 Noodle continuous-line SVG illustrations in a white legibility badge.
//
// ROUND 19 — "cancela a ideia das illustrations, coloca só um ícone": Hugo reverted the
// custom-illustration approach (the 5 Noodle SVGs + white badge), not the underlying
// idea of a reactive visual — the summary panel still needs to show the student's
// OVERALL tone at a glance. The simplification: ONE Lucide icon per tone instead of a
// custom SVG, reusing the SAME icon vocabulary the table already speaks (the "Como
// estou" chip, `LEITURA_CHIP` below in comparison-insights-table.tsx, already uses
// `TrendingUp` for win and `Minus` for tie — reused verbatim here, not reinvented). The
// chip collapses both behind severities into one `ArrowRight` (differentiated only by
// colour), but this panel is the ONE place summarising the student's OVERALL standing,
// so the two behind severities get their own glyphs for a clearer signal at a glance:
// `AlertTriangle` (behind-mild, a gentle nudge) and `AlertCircle` (behind-severe, more
// urgent) — both already used dozens of times elsewhere in the app (grepped before
// picking, same "reuse, don't invent" discipline as Round 10's `ACTION_ICON`), not new
// glyphs invented for this panel. `Compass` covers `none` (still finding the way,
// coherent with the "minha jornada" subtitle from Round 18). Tone STILL comes from
// `summaryToneOf` (severity-first + #1 override, see ritmo-summary.ts) — unchanged,
// only WHAT renders per tone changed, from illustration to icon.
//
// No white badge needed this round: unlike the Noodle line-art (black on transparent,
// invisible on the dark panel), a Lucide glyph is a single-colour vector controlled
// directly via `text-*`, so the icon sits in a small tone-tinted circle (the SAME
// tinted-family classes `LEITURA_CHIP` already uses, e.g. `bg-semantic-success/10
// text-semantic-success` for win) — legible on the dark panel with no extra backdrop.
// ---------------------------------------------------------------------------

/** The reactive icon per overall tone (ROUND 19). One Lucide glyph per `Leitura["tone"]`. */
const RITMO_ICON: Record<SummaryTone, { Icon: LucideIcon; className: string; alt: string }> = {
  win: {
    Icon: TrendingUp,
    className: "bg-semantic-success/10 text-semantic-success",
    alt: "Você está à frente da turma",
  },
  tie: {
    Icon: Minus,
    className: "bg-semantic-warning/15 text-semantic-warning",
    alt: "Você está no ritmo da turma",
  },
  "behind-mild": {
    Icon: AlertTriangle,
    className: "bg-semantic-warning/10 text-semantic-warning",
    alt: "Um lembrete gentil para retomar",
  },
  "behind-severe": {
    Icon: AlertCircle,
    className: "bg-semantic-error/10 text-semantic-error",
    alt: "Hora de retomar o ritmo",
  },
  none: { Icon: Compass, className: "bg-white/10 text-white/70", alt: "Começando a sua jornada" },
}

function RitmoSummaryPanel({
  summary,
  tone,
}: {
  summary: string
  tone: SummaryTone
}) {
  const { Icon, className, alt } = RITMO_ICON[tone]
  return (
    <div className="mt-5 flex flex-col gap-5 rounded-2xl bg-neutral-900 px-5 py-5 dark:bg-black/40 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6">
      <p data-testid="ritmo-summary" className="flex-1 text-base leading-relaxed text-white">
        {`"${summary}"`}
      </p>
      {/* ROUND 19 — one tone-reactive icon, docked where the CTA/illustration used to be. */}
      <div
        data-testid="ritmo-icon"
        data-tone={tone}
        aria-label={alt}
        className={`flex h-14 w-14 shrink-0 items-center justify-center self-end rounded-full sm:self-center ${className}`}
      >
        <Icon size={26} aria-hidden="true" />
      </div>
    </div>
  )
}
