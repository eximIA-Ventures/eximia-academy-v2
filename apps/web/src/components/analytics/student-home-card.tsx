"use client"

// ---------------------------------------------------------------------------
// StudentHomeCard — the integration container for the Student Home redesign
// ---------------------------------------------------------------------------
// SH-1.4 (EPIC-STUDENT-HOME). This is the NEW home card that orchestrates the
// three core slices behind one intent toggle:
//
//   student-dashboard → StudentComparison (fetch wrapper) → StudentHomeCard
//     ├─ "Meu progresso"  (default)  → StudentProgressHeadline        [SH-1.3]
//     └─ "Como me comparo"           → IndicatorComparisonTable       [SH-1.2]
//                                       │ (default sub-view: table)
//                                       └─ SignalRowsView (barras)     (detailed)
//
// THREE invariants this container enforces (Direção do epic §3 + plano §2):
//   1. COMPARISON IS NOT THE ENTRY VERDICT. The toggle opens on `'progress'`,
//      never `'compare'` (AC2). Inside compare, the indicator table is the
//      default sub-view, not the bars (`compareView: 'table'`, AC3).
//   2. THE CTA IS INVARIANT. "Continuar agora" (NextStepBar) is rendered ONCE by
//      this container, OUTSIDE the view switch (AC5 / plano §2.3). Switching the
//      toggle never moves it, never changes its href or text. To guarantee a
//      SINGLE CTA, the progress headline's own promoted CTA is suppressed
//      (`showCta={false}`) and reproduced here from the same
//      `buildProgressHeadline` suggestion + the same `continueHref`.
//   3. THE BARS SURVIVE. The current `SignalRow` bars are NOT deleted; they are
//      the detailed comparison sub-view (`compareView: 'bars'`, AC4).
//
// suppressComparison: the caller-side decision (SH-1.2 obeys the prop) — when
// the UNIDADE has too few students the average is noise, so the comparison hint
// is suppressed. The threshold lives HERE as a named constant (AC6, R3).
//
// The median/IQR reanchoring of the reference column (SH-1.1 `referenceStats`)
// and the data-driven highlight of each row are SH-1.5's job; this container
// wires the STRUCTURE and uses the unit average as the reference for now (the
// same reference `buildSignalRows` already uses), with a simple "best relative
// lead" highlight placeholder that SH-1.5 refines.
// ---------------------------------------------------------------------------

import type { ComparableMetricBlock } from "@/types/analytics"
import { useState } from "react"
import { IndicatorComparisonTable, type IndicatorRow } from "./indicator-comparison-table"
import { buildProgressHeadline, toMetricBar } from "./student-comparison-scale"
import {
  Card,
  DEFAULT_CONTINUE_HREF,
  NextStepBar,
  SignalRowsView,
  buildSignalRows,
  signalMetrics,
} from "./student-comparison-view"
import { StudentProgressHeadline } from "./student-progress-headline"

/**
 * Below this UNIDADE size the average is statistically noisy (a single outlier
 * drags it), so the comparison delta is suppressed and only honest raw values +
 * proportional bars show. Named constant so the threshold is calibrable in one
 * place, never a magic number sprinkled around (AC6 / risk R3). SH-1.5 documents
 * the same threshold for the "mediana vs média" reanchoring.
 */
export const SUPPRESS_COMPARISON_MIN_STUDENTS = 5

type Intent = "progress" | "compare"
type CompareView = "table" | "bars"

/**
 * Derive the indicator-table rows from the shared `signalMetrics` definition.
 * Pure. `reflections` is neutral context (never colored — matches the epic's
 * premise and SH-1.2's reuse convention); the single row with the best positive
 * relative lead is the hot highlight (SH-1.5 refines this to the data-driven
 * "where the subject stands out" rule + median reference).
 */
function buildIndicatorRows(
  student: ComparableMetricBlock,
  unit: ComparableMetricBlock,
): IndicatorRow[] {
  const metrics = signalMetrics(student, unit)

  let hotKey: string | null = null
  let bestDelta = 0
  for (const m of metrics) {
    if (m.key === "reflections") continue // neutral context — never hot
    const bar = toMetricBar(m)
    if (bar.deltaPct !== null && bar.deltaPct > bestDelta) {
      bestDelta = bar.deltaPct
      hotKey = m.key
    }
  }

  return metrics.map((m) => ({
    key: m.key,
    label: m.label,
    subjectValue: m.studentValue,
    referenceValue: m.unitValue,
    format: m.format,
    referenceLabel: "média",
    highlight: m.key === hotKey,
    neutral: m.key === "reflections",
  }))
}

// ---------------------------------------------------------------------------
// Intent toggle — segmented control. "Meu progresso" (default) / "Como me
// comparo". Standard Tailwind utilities only (CSS-pipeline immunity, per the
// sibling components). aria-pressed drives the active styling + a11y.
// ---------------------------------------------------------------------------

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
  const indicatorRows = buildIndicatorRows(student, unit)

  // suppressComparison decided HERE (caller), passed as a prop to the table.
  const suppressComparison = unit.totalStudents < SUPPRESS_COMPARISON_MIN_STUDENTS

  // The invariant CTA suggestion — SAME source the progress headline uses, so
  // hiding the headline's own CTA (showCta={false}) and rendering it here loses
  // nothing: identical text + identical href, rendered once, outside the switch.
  const progress = buildProgressHeadline(bars)
  const ctaSuggestion = progress.nextStep ?? "faça a próxima sessão da sua trilha."

  return (
    <div className="space-y-4" data-testid="student-home-card">
      {/* Intent toggle (outside the switch). */}
      {/* biome-ignore lint/a11y/useSemanticElements: segmented toggle of two buttons; role="group" + aria-label is the idiomatic pattern here (a <fieldset> would imply a form context that does not exist). */}
      <div className="flex items-center gap-2" role="group" aria-label="Intenção da home">
        <SegButton active={intent === "progress"} onClick={() => setIntent("progress")}>
          Meu progresso
        </SegButton>
        <SegButton active={intent === "compare"} onClick={() => setIntent("compare")}>
          Como me comparo
        </SegButton>
      </div>

      {/* INVARIANT CTA — rendered ONCE, outside the view switch (AC5). Toggling
          intent/compareView never re-renders or moves this element. */}
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
        />
      ) : (
        <Card>
          <div className="space-y-5">
            {/* Header + sub-view toggle for the comparison. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-text-primary">
                  Como me comparo
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  Comparado à média da unidade {unitName} nos últimos 30 dias.
                </p>
              </div>
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
              <IndicatorComparisonTable
                rows={indicatorRows}
                subjectLabel="Você"
                referenceLabel={`Média · ${unitName}`}
                suppressComparison={suppressComparison}
              />
            ) : (
              <SignalRowsView bars={bars} />
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
