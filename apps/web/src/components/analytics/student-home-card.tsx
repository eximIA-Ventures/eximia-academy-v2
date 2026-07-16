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

import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { Card, CardContent, CardHeader } from "@eximia/ui"
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
  indicators,
  continueHref = DEFAULT_CONTINUE_HREF,
  studentFirstName,
  showNextStep = true,
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
   * Minha Jornada v6.1 (Hugo 2026-07-16): quando o dashboard renderiza o card
   * "Próximo passo" provocativo como CTA único, a NextStepBar daqui é
   * suprimida (false) para não duplicar. Default true preserva o comportamento
   * em qualquer outro uso.
   */
  showNextStep?: boolean
}) {
  const [compareView, setCompareView] = useState<CompareView>("table")

  const bars = buildSignalRows(student, unit)

  // The single CTA's coaching line, derived from the student's own progress.
  const progress = buildProgressHeadline(bars)
  const ctaSuggestion = progress.nextStep ?? "faça a próxima sessão da sua trilha."

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
                  1ª pessoa — o standing "No geral, ..." e a promoção do módulo
                  atual foram removidos; a leitura por indicador vive na coluna
                  Leitura da tabela. */}
              <p className="mt-1 text-xs text-text-muted">
                Como estou em relação à turma nos últimos 30 dias.
              </p>
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
            <ComparisonInsightsTable indicators={indicators} studentFirstName={studentFirstName} />
          ) : (
            <SignalRowsView bars={bars} />
          )}
        </CardContent>
      </Card>

      {/* M1 — the single next-step CTA "Próximo passo / Continuar agora" now sits
          BELOW the comparison card. */}
      {showNextStep && <NextStepBar suggestion={ctaSuggestion} href={continueHref} />}
    </div>
  )
}
