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
// RitmoSummaryPanel — SH-1.5 R2, reworked in ROUND 18 (Hugo 2026-07-18).
//
// R2 shipped this as a dark panel with the deterministic summary + a "Continuar agora"
// CTA in the corner. Hugo found it "esquisito" and asked to (a) REMOVE the CTA (it
// duplicated the per-row CTA every table row already has since R4/R6) and (b) add a
// REACTIVE illustration that changes with the student's performance.
//
// ILLUSTRATION (decision): the 5 Noodle continuous-line glyphs map 1:1 to the SAME
// 5 tones that govern the whole table (`Leitura["tone"]`) — no sixth taxonomy. The
// glyph shown reflects the OVERALL tone (`summaryToneOf`, severity-first with a #1
// celebratory override — see ritmo-summary.ts). Assets live in /public/illustrations/
// as `ritmo-{tone}.svg` (copied from the Noodle-Illustrations pack).
//
// LEGIBILITY (why the white badge): the Noodle line-art is BLACK on transparent, which
// would vanish on the dark panel (only the coloured accents would show). So the glyph
// sits inside a soft WHITE rounded "badge" (bg-white), which reads as an intentional
// framed illustration AND guarantees the line-art is visible on the dark band. The
// paragraph reads full-width first; the badge docks where the CTA used to be (right on
// wide screens, below the text on small) — same corner, new purpose.
// ---------------------------------------------------------------------------

/** The reactive illustration per overall tone (ROUND 18). One glyph per `Leitura["tone"]`. */
const RITMO_ILLUSTRATION: Record<SummaryTone, { src: string; alt: string }> = {
  win: { src: "/illustrations/ritmo-win.svg", alt: "Você está à frente da turma" },
  tie: { src: "/illustrations/ritmo-tie.svg", alt: "Você está no ritmo da turma" },
  "behind-mild": {
    src: "/illustrations/ritmo-behind-mild.svg",
    alt: "Um lembrete gentil para retomar",
  },
  "behind-severe": {
    src: "/illustrations/ritmo-behind-severe.svg",
    alt: "Hora de retomar o ritmo",
  },
  none: { src: "/illustrations/ritmo-none.svg", alt: "Começando a sua jornada" },
}

function RitmoSummaryPanel({
  summary,
  tone,
}: {
  summary: string
  tone: SummaryTone
}) {
  const illustration = RITMO_ILLUSTRATION[tone]
  return (
    <div className="mt-5 flex flex-col gap-5 rounded-2xl bg-neutral-900 px-5 py-5 dark:bg-black/40 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6">
      <p data-testid="ritmo-summary" className="flex-1 text-base leading-relaxed text-white">
        {`"${summary}"`}
      </p>
      {/* ROUND 18 — reactive illustration in a white badge (line-art needs a light
          backdrop on the dark panel). Docked where the CTA used to be. */}
      <div className="flex shrink-0 self-end sm:self-center">
        <img
          data-testid="ritmo-illustration"
          data-tone={tone}
          src={illustration.src}
          alt={illustration.alt}
          className="h-24 w-24 rounded-2xl bg-white p-2 sm:h-28 sm:w-28"
        />
      </div>
    </div>
  )
}
