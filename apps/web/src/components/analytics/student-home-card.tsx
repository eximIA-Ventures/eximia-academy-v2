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
  unitName,
  continueHref = DEFAULT_CONTINUE_HREF,
}: {
  student: ComparableMetricBlock
  unit: ComparableMetricBlock
  unitName: string
  continueHref?: string
}) {
  const [compareView, setCompareView] = useState<CompareView>("table")

  const bars = buildSignalRows(student, unit)

  // The single CTA's coaching line, derived from the student's own progress.
  const progress = buildProgressHeadline(bars)
  const ctaSuggestion = progress.nextStep ?? "faça a próxima sessão da sua trilha."

  return (
    <div className="space-y-4" data-testid="student-home-card">
      {/* The single next-step CTA — "Próximo passo / Continuar agora". */}
      <NextStepBar suggestion={ctaSuggestion} href={continueHref} />

      {/* The comparison — the DEFAULT and ONLY view. */}
      <div className="rounded-2xl bg-bg-card p-6 shadow-card dark:shadow-sm dark:ring-1 dark:ring-white/5 sm:p-7">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              Comparado à média da unidade {unitName} nos últimos 30 dias.
            </p>
            {/* THE single toggle — comparison format: Visão detalhada / Gráficos.
                The two buttons carry aria-pressed, so they are self-describing. */}
            <div className="flex shrink-0 items-center gap-2">
              <SegButton active={compareView === "table"} onClick={() => setCompareView("table")}>
                Visão detalhada
              </SegButton>
              <SegButton active={compareView === "bars"} onClick={() => setCompareView("bars")}>
                Gráficos
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
    </div>
  )
}
