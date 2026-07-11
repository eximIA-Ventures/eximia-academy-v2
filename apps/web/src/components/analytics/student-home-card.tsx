"use client"

// ---------------------------------------------------------------------------
// StudentHomeCard — the integration container for the Student Home redesign
// ---------------------------------------------------------------------------
// SH-1.4 (EPIC-STUDENT-HOME) + UX rework (Hugo, 2026-07-11). The home card
// orchestrates the three core slices behind ONE intent toggle:
//
//   student-dashboard → StudentComparison (fetch wrapper) → StudentHomeCard
//     ├─ "Meu progresso"  (default)  → StudentProgressHeadline        [SH-1.3]
//     └─ "Como me comparo"           → ComparisonInsightsTable        (Hugo)
//                                       │ (default sub-view: Tabela)
//                                       └─ SignalRowsView (Barras)     (detailed)
//
// THREE things the rework fixed (Hugo's exact instruction, not the old story):
//   1. COMPARISON TABLE = manager "Tabela simplificada" grammar: 2 rows
//      (Você / Média · unidade), indicators in COLUMNS. Lives in
//      comparison-insights-table.tsx. Hot green only where Você stands out;
//      Média is a neutral, lighter rule. (Replaces the old indicator-per-row
//      table for the home comparison.)
//   2. ONE next-step CTA. The duplicate "Sua próxima sessão está pronta" banner
//      was removed (dashboard + preview); the single CTA is this "Próximo passo"
//      NextStepBar, rendered ONCE OUTSIDE the view switch (invariant href+text).
//   3. CLEAN TOGGLE HIERARCHY. The intent toggle at the top IS the section
//      label — no view repeats its own name as a heading (StudentProgressHeadline
//      renders with showTitle={false}); the Tabela/Barras sub-toggle appears
//      ONLY inside the comparison view.
//
// The default is "Meu progresso" (comparison is never the entry verdict) and,
// inside "Como me comparo", the Tabela is the default sub-view (bars = detailed).
// ---------------------------------------------------------------------------

import type { ComparableMetricBlock } from "@/types/analytics"
import { useState } from "react"
import { ComparisonInsightsTable } from "./comparison-insights-table"
import { buildProgressHeadline } from "./student-comparison-scale"
import {
  DEFAULT_CONTINUE_HREF,
  NextStepBar,
  SignalRowsView,
  buildSignalRows,
} from "./student-comparison-view"
import { StudentProgressHeadline } from "./student-progress-headline"

type Intent = "progress" | "compare"
type CompareView = "table" | "bars"

// ---------------------------------------------------------------------------
// Segmented control button — standard Tailwind utilities only (CSS-pipeline
// immunity, per the sibling components). aria-pressed drives active styling.
// ---------------------------------------------------------------------------

// Active-pill literals (theme.css --color-cerrado-600). Carried INLINE, per the
// house CSS-STALE IMMUNITY pattern (see student-comparison-view.tsx): the active
// state is critical, and a stale/tree-shaken `bg-cerrado-600` must never leave
// the selected toggle looking unselected. The class stays as progressive
// enhancement; the inline style is the guarantee. `active` derives ONLY from the
// same `intent` state that drives the content — no separate/hardcoded flag.
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

// ---------------------------------------------------------------------------
// StudentHomeCard
// ---------------------------------------------------------------------------

export function StudentHomeCard({
  student,
  unit,
  unitName,
  continueHref = DEFAULT_CONTINUE_HREF,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
  continueHref?: string
}) {
  const [intent, setIntent] = useState<Intent>("progress")
  const [compareView, setCompareView] = useState<CompareView>("table")

  const bars = buildSignalRows(student, unit)

  // The invariant CTA suggestion — SAME source the progress headline uses, so
  // suppressing the headline's own CTA (showCta={false}) and rendering it here
  // loses nothing: identical text + identical href, rendered once, outside the
  // switch, so toggling never moves or changes the CTA.
  const progress = buildProgressHeadline(bars)
  const ctaSuggestion = progress.nextStep ?? "faça a próxima sessão da sua trilha."

  return (
    <div className="space-y-4" data-testid="student-home-card">
      {/* Intent toggle — the section label itself (no view repeats its name). */}
      {/* biome-ignore lint/a11y/useSemanticElements: segmented toggle of two buttons; role="group" + aria-label is the idiomatic pattern (a <fieldset> would imply a form context that does not exist). */}
      <div className="flex items-center gap-2" role="group" aria-label="Intenção da home">
        <SegButton active={intent === "progress"} onClick={() => setIntent("progress")}>
          Meu progresso
        </SegButton>
        <SegButton active={intent === "compare"} onClick={() => setIntent("compare")}>
          Como me comparo
        </SegButton>
      </div>

      {/* SINGLE next-step CTA — rendered ONCE, OUTSIDE the view switch. Toggling
          intent/compareView never re-renders, moves, or changes it. */}
      <NextStepBar suggestion={ctaSuggestion} href={continueHref} />

      {/* View switch. */}
      {intent === "progress" ? (
        <StudentProgressHeadline
          bars={bars}
          completionPct={student.completionPct}
          consciousCompletionPct={student.consciousCompletionPct}
          avgDepth={student.avgDepth}
          continueHref={continueHref}
          showCta={false}
          showTitle={false}
        />
      ) : (
        <div className="rounded-2xl bg-bg-card p-6 shadow-card dark:shadow-sm dark:ring-1 dark:ring-white/5 sm:p-7">
          <div className="space-y-4">
            {/* Small context caption + the Tabela/Barras sub-toggle (no title
                duplicating the "Como me comparo" toggle above). */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">
                Comparado à média da unidade {unitName} nos últimos 30 dias.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <SegButton active={compareView === "table"} onClick={() => setCompareView("table")}>
                  Tabela
                </SegButton>
                <SegButton active={compareView === "bars"} onClick={() => setCompareView("bars")}>
                  Barras
                </SegButton>
              </div>
            </div>

            {compareView === "table" ? (
              <ComparisonInsightsTable student={student} unit={unit} unitName={unitName} />
            ) : (
              <SignalRowsView bars={bars} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
