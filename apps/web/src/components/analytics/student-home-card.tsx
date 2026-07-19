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
// RitmoSummaryPanel — SH-1.5 R2, illustration added in ROUND 18, simplified to an
// icon in ROUND 19, redesigned as a personal headline card in ROUND 20 (Hugo
// 2026-07-18).
//
// R2 shipped this as a dark panel with the deterministic summary + a "Continuar agora"
// CTA in the corner. Round 18 removed the CTA and added 5 Noodle illustrations. Round
// 19 swapped the illustrations for one reactive Lucide icon.
//
// ROUND 20 — "ainda não tá legal esse visual... tem que ser algo que o cara olhe e
// pense 'caralho, captei vossa mensagem'", narrowed to "to falando só da frase, acho
// que podemos mudar o visual do card da frase" (the ASK is about the card's
// PRESENTATION, not the table or the Round 19 icon). Offered 3 directions — (a) a
// tone-tinted glow/gradient instead of flat black, (b) drop the quote-mark/testimonial
// format for a personal 1st-person headline with the key line in bold/colour, (c) more
// physical presence (shadow/border/glow) — Hugo: "me surpreende, só não exagera".
//
// DECISION — ONE idea, applied consistently, not three separate effects stacked:
// the reactive TONE becomes the card's whole colour language. Two concrete moves
// carry that idea (not three independent tricks):
//   1. The quote format is GONE. `buildRitmoSummary`'s two-sentence contract (opening
//      + clauses, then the opportunity clause — see the function's own
//      `${firstSentence} ${opportunity}` return) is split for PRESENTATION ONLY
//      (`splitHeadline`, below — a plain string split on the sentence boundary the
//      function already produces; it does NOT touch `buildRitmoSummary`'s logic, only
//      how the existing string is laid out on screen). The first sentence renders as a
//      bold, larger HEADLINE in the tone's own colour (the "you got it" read: the
//      claim that matters is the first thing the eye hits, in the colour that already
//      means something everywhere else in this table); the closing "oportunidade"
//      sentence renders small and muted underneath, in a supporting role instead of
//      competing for attention.
//   2. A soft radial glow, tinted by the SAME tone, replaces the flat `bg-neutral-900`
//      backdrop — direction (a). ONE glow in one corner, low opacity (16-18%), no
//      second light source, no border, no extra ring: option (c) (border + stronger
//      shadow) was DELIBERATELY DROPPED to avoid stacking a third device on top of the
//      other two — the brief was "one or two strong moves", not every good idea at
//      once.
// The Round 19 icon STAYS (Hugo's call: "pode continuar existindo... ou sair, sua
// decisão") but shrinks slightly (h-14→h-12, 26px→22px glyph) so it reads as a quiet
// accent next to the now-louder coloured headline, not a second competing focal point.
//
// WHY oklch-with-alpha inline, not a Tailwind opacity class: the glow needs a colour
// fraction that may not already exist as a literal string elsewhere in the app (the
// EXACT failure mode documented in Round 16 — Tailwind v4 only generates CSS for an
// opacity fraction it finds scanned in source; an unscanned `/NN` silently renders
// transparent). Hardcoding the full `oklch(L C H / alpha%)` string as an inline
// `backgroundImage` sidesteps the scanner entirely — same "CSS-STALE IMMUNITY" inline
// pattern this file already uses for `SEG_ACTIVE_BG` above, applied to a gradient
// instead of a solid fill. Tie and behind-mild share the SAME warning token at
// different alpha (16% vs 18%), the same "one token, two opacities" device Round 14/15
// used to distinguish the two ambers without inventing a second yellow.
//
// ROUND 21 (Hugo 2026-07-18, screenshot: "tem muito verde, então coloca por padrão no
// laranja da academy" + "pode deixar um pouco menor") — TWO changes, both presentation:
//   1. `win`'s colour (icon tint, headline, glow) moved from `semantic-success` (green)
//      to `cerrado-600` (the SAME brand orange `SEG_ACTIVE_BG` above already hardcodes —
//      literally the same oklch triple, `0.64 0.17 42`), mirroring the identical change
//      made to the table's `LEITURA_CHIP`/`WIN_BG`/`ACTION_TONE` in
//      comparison-insights-table.tsx (Round 21). No collision with `none` HERE: `none`'s
//      colour in this panel is neutral white (`bg-white/10 text-white/70`), not cerrado —
//      unlike the table's action button, this component has no win↔none ambiguity to
//      resolve, so win uses the full `cerrado-600` (not a lighter `-500` shade).
//   2. The headline shrank one step (`text-lg`/`sm:text-xl` → `text-base`/`sm:text-lg`) —
//      the screenshot showed the personal headline reading as too dominant relative to the
//      support line and icon beside it. Still bold and tone-coloured (the Round 20 idea is
//      untouched), just less loud.
// The global `--color-semantic-success` token is NOT touched — this recolours `win` only
// inside this component, same scope discipline as the table's Round 21 change.
// ---------------------------------------------------------------------------

/** Splits `buildRitmoSummary`'s output into headline + support line (ROUND 20,
 * PRESENTATION ONLY). Relies on the function's own contract — exactly one period ends
 * the first sentence, then a space, then the closing "oportunidade" sentence — so this
 * never touches or re-derives what `buildRitmoSummary` decides to say, only how the
 * fixed two-sentence shape is laid out visually. */
function splitHeadline(summary: string): { headline: string; support: string } {
  const match = summary.match(/^(.*?\.)\s+(.*)$/s)
  if (!match) return { headline: summary, support: "" }
  return { headline: match[1], support: match[2] }
}

/** The reactive style per overall tone (ROUND 20). One glow + one headline colour +
 * one icon, all derived from the SAME tone — a single colour idea applied three times,
 * not three separate effects. `Icon`/icon `className` are UNCHANGED from Round 19. */
const RITMO_TONE_STYLE: Record<
  SummaryTone,
  { Icon: LucideIcon; iconClassName: string; headlineClassName: string; glow: string; alt: string }
> = {
  win: {
    Icon: TrendingUp,
    iconClassName: "bg-cerrado-600/10 text-cerrado-600",
    headlineClassName: "text-cerrado-600",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.64 0.17 42 / 18%) 0%, transparent 60%)",
    alt: "Você está à frente da turma",
  },
  tie: {
    Icon: Minus,
    iconClassName: "bg-semantic-warning/15 text-semantic-warning",
    headlineClassName: "text-semantic-warning",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.8 0.15 70 / 16%) 0%, transparent 60%)",
    alt: "Você está no ritmo da turma",
  },
  "behind-mild": {
    Icon: AlertTriangle,
    iconClassName: "bg-semantic-warning/10 text-semantic-warning",
    headlineClassName: "text-semantic-warning",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.8 0.15 70 / 18%) 0%, transparent 60%)",
    alt: "Um lembrete gentil para retomar",
  },
  "behind-severe": {
    Icon: AlertCircle,
    iconClassName: "bg-semantic-error/10 text-semantic-error",
    headlineClassName: "text-semantic-error",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(0.6 0.22 25 / 18%) 0%, transparent 60%)",
    alt: "Hora de retomar o ritmo",
  },
  none: {
    Icon: Compass,
    iconClassName: "bg-white/10 text-white/70",
    headlineClassName: "text-white",
    glow: "radial-gradient(120% 140% at 100% 0%, oklch(1 0 0 / 6%) 0%, transparent 60%)",
    alt: "Começando a sua jornada",
  },
}

function RitmoSummaryPanel({
  summary,
  tone,
}: {
  summary: string
  tone: SummaryTone
}) {
  const { Icon, iconClassName, headlineClassName, glow, alt } = RITMO_TONE_STYLE[tone]
  const { headline, support } = splitHeadline(summary)
  return (
    <div
      className="relative mt-5 flex flex-col gap-5 overflow-hidden rounded-2xl bg-neutral-900 px-5 py-5 dark:bg-black/40 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6"
      style={{ backgroundImage: glow }}
    >
      {/* ROUND 20 — no more quote marks: a bold, tone-coloured HEADLINE (the claim
          that matters, first thing the eye hits) + a small muted support line
          (the opportunity clause), instead of one flat quoted paragraph. */}
      <div data-testid="ritmo-summary" className="flex-1">
        <p className={`text-base font-bold leading-snug sm:text-lg ${headlineClassName}`}>
          {headline}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{support}</p>
      </div>
      {/* ROUND 19 — the tone-reactive icon stays, shrunk slightly (Round 20) so it
          reads as a quiet accent beside the now-coloured headline. */}
      <div
        data-testid="ritmo-icon"
        data-tone={tone}
        aria-label={alt}
        className={`flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full sm:self-center ${iconClassName}`}
      >
        <Icon size={22} aria-hidden="true" />
      </div>
    </div>
  )
}
