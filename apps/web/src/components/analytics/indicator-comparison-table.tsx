// ---------------------------------------------------------------------------
// IndicatorComparisonTable — PURE PRESENTATION spine for "Como me comparo"
// ---------------------------------------------------------------------------
// The reusable visual spine of the Student Home redesign (EPIC-STUDENT-HOME,
// SH-1.2). One row per indicator, in the shape:
//
//     rótulo | valor do sujeito | valor de referência | barra comparativa
//
// It is the SAME component for the student ("Você" × média da unidade) and for
// the manager ("time" × "org") — the contract binds to a generic subject vs
// reference pair, never to the word "aluno" (AC7). It owns NO data lifecycle:
// no fetch, no business state. It receives already-mapped IndicatorRow[] and
// renders. The real mapping (MetricBar[] → IndicatorRow[]) belongs to SH-1.5.
//
// TWO BANNED PATTERNS, enforced here by construction:
//   1. PUNITIVE RED. "Abaixo" da referência is NEUTRAL (grey), never red, never
//      a "you failed" signal. Only the HOT highlight (biome color) exists, and
//      it appears ONLY where the subject stands out (`row.highlight`). There is
//      no punitive color path in this file at all (grep-provable clean).
//   2. THE MISLEADING "+525%". This component never computes or shows a relative
//      percentage delta on its own. The comparison it renders is the honest
//      proportional bar (shared max, via toMetricBar) plus a NEUTRAL directional
//      word. When the caller passes `suppressComparison`, even that word is
//      hidden — values and bar remain. WHEN to suppress is the caller's call
//      (SH-1.4, e.g. totalStudents < 5); this component only obeys the prop.
//
// GEOMETRY REUSE: bar widths + display strings come from `toMetricBar`
// (student-comparison-scale.ts, unit-tested — honest shared-max scale, division
// -by-zero guarded). This file does NOT reimplement that math (AC1, R2).
//
// BIOME COLORS: the hot color per indicator reuses the exported BIOME /
// BIOME_COLOR maps (student-comparison-view.tsx), keyed by `row.key`, with a
// brand-cerrado fallback for keys outside the student set (e.g. manager rows).
//
// CSS-PIPELINE IMMUNITY (mirrors student-comparison-view.tsx): only standard
// Tailwind utilities (no arbitrary `[...]` values, which were seen to drop out
// of a production Docker layer cache), and every CRITICAL color/size (bar fills,
// track, subject value color) ALSO travels inline as `style={{...}}` so stale
// CSS can never make a bar invisible or a value fall to black.
// ---------------------------------------------------------------------------

import { type ComparisonMetric, type MetricBar, toMetricBar } from "./student-comparison-scale"
import { BIOME, BIOME_COLOR } from "./student-comparison-view"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** One indicator = one row. Generic subject-vs-reference pair (aluno OR gestor). */
export interface IndicatorRow {
  /** Stable key for React lists AND biome color lookup. */
  key: string
  /** Human label shown on the row (pt-BR). */
  label: string
  /** The subject's raw value ("Você" no aluno, o time no gestor). */
  subjectValue: number
  /** The reference's raw value (média da unidade, org). */
  referenceValue: number
  /** How to render the numbers. */
  format: ComparisonMetric["format"]
  /** Prefix for the reference value cell. Default "média". */
  referenceLabel?: string
  /** true → THIS indicator is the hot highlight (biome color). Where the subject stands out. */
  highlight?: boolean
  /** true → pure context, NEVER colored and NEVER shows a comparison hint (e.g. Reflexões, SH-1.5). */
  neutral?: boolean
}

export interface IndicatorComparisonTableProps {
  /** The indicator rows, already mapped. */
  rows: IndicatorRow[]
  /** The subject column label ("Você" no aluno; nome do time no gestor). */
  subjectLabel: string
  /** The reference column label ("Média da unidade", "Org"). Used in the legend. */
  referenceLabel: string
  /**
   * true → hide every "abaixo"/comparison hint (the caller decided the reference
   * has too little statistical mass to compare against). Raw values and the
   * proportional bar STAY visible. This component never shows a relative
   * percentage delta regardless — the honest bar is the comparison.
   */
  suppressComparison?: boolean
  /** "biome" (default) → hot rows get their biome color. "neutral" → no biome color anywhere. */
  colorScheme?: "biome" | "neutral"
}

// ---------------------------------------------------------------------------
// Neutral, theme-independent bar tints. Inline literals so no stale CSS can
// make a bar vanish. The SUBJECT neutral fill is deliberately HEAVIER than the
// REFERENCE fill so the reference rail is always visually lighter (AC5) — in
// both light and dark themes (dark: classes ride on top as enhancement).
// ---------------------------------------------------------------------------

const BAR_TRACK_BG = "rgba(0, 0, 0, 0.05)" // trilho — mirrors bg-black/5
const BAR_SUBJECT_NEUTRAL_FILL = "rgba(0, 0, 0, 0.48)" // sujeito sem destaque — cinza forte
const BAR_REFERENCE_FILL = "rgba(0, 0, 0, 0.20)" // referência — régua neutra, mais leve

/** Brand cerrado-600 (theme.css) — hot fallback for keys outside the student set. */
const FALLBACK_HOT_COLOR = "oklch(0.64 0.17 42)"
const FALLBACK_HOT_BAR = "bg-cerrado-600"

// ---------------------------------------------------------------------------
// Row resolution — pure, no JSX. Decides the single question that drives the
// visuals: is this row HOT (biome highlight) or NEUTRAL? Everything punitive is
// impossible here: the only two outcomes are "hot" or "neutral grey".
// ---------------------------------------------------------------------------

interface ResolvedRow {
  row: IndicatorRow
  bar: MetricBar
  /** true → paint this row with its biome color; false → neutral grey. */
  hot: boolean
  /** Hot biome color (only meaningful when `hot`). */
  hotColor: string
  /** Hot biome bar utility class (only meaningful when `hot`). */
  hotBarClass: string
}

/**
 * A row is HOT only when: it is flagged `highlight`, it is NOT `neutral`, and
 * the table color scheme is "biome". In every other case (default, "abaixo",
 * neutral row, or colorScheme "neutral") the row is neutral grey. There is no
 * branch that produces red — being below the reference is simply NOT hot.
 */
function resolveRow(row: IndicatorRow, colorScheme: "biome" | "neutral"): ResolvedRow {
  const bar = toMetricBar({
    key: row.key,
    label: row.label,
    studentValue: row.subjectValue,
    unitValue: row.referenceValue,
    format: row.format,
  })
  const hot = row.highlight === true && row.neutral !== true && colorScheme === "biome"
  return {
    row,
    bar,
    hot,
    hotColor: BIOME_COLOR[row.key] ?? FALLBACK_HOT_COLOR,
    hotBarClass: BIOME[row.key]?.bar ?? FALLBACK_HOT_BAR,
  }
}

// ---------------------------------------------------------------------------
// Comparison hint — a NEUTRAL directional word, never a color-coded verdict.
// Hidden entirely when the row is `neutral` (pure context) or when the table
// has `suppressComparison`. No percentage is ever shown (the honest bar is the
// comparison; "+525%" is structurally impossible here). "Abaixo" is muted grey,
// exactly like "acima" — direction without punishment.
// ---------------------------------------------------------------------------

function ComparisonHint({ bar }: { bar: MetricBar }) {
  const ahead = bar.studentAhead
  return (
    <span
      data-testid="comparison-hint"
      className="inline-flex items-center whitespace-nowrap rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-text-muted dark:bg-white/5"
    >
      {ahead ? "acima" : "abaixo"}
    </span>
  )
}

// ---------------------------------------------------------------------------
// One indicator row.
//
// IMMUNE LAYOUT (mirrors SignalRow): a flex split into a LEFT HALF (label |
// value | reference | hint, fixed-width cells so columns line up without an
// arbitrary grid template) and a RIGHT HALF (two proportional bars). Below sm
// the bars hide and the textual comparison carries the row (mobile). Only
// standard Tailwind utilities; critical colors also inline.
// ---------------------------------------------------------------------------

function IndicatorRowView({
  resolved,
  suppressComparison,
}: {
  resolved: ResolvedRow
  suppressComparison: boolean
}) {
  const { row, bar, hot, hotColor, hotBarClass } = resolved
  const referencePrefix = row.referenceLabel ?? "média"
  // Show the hint only when it is neither a pure-context row nor suppressed.
  const showHint = row.neutral !== true && !suppressComparison

  // Subject value color: hot → biome (inline literal + class); neutral → strong
  // primary text (readable, uncolored). NEVER red. NEVER a "below" color.
  const subjectValueClass = hot
    ? `w-16 shrink-0 text-xl font-bold tabular-nums ${BIOME[row.key]?.text ?? "text-cerrado-600"}`
    : "w-16 shrink-0 text-xl font-bold tabular-nums text-text-primary"
  const subjectValueStyle = hot ? { color: hotColor } : undefined

  // Subject bar fill: hot → biome; neutral → heavy grey (always heavier than the
  // reference rail so the reference reads lighter — AC5).
  const subjectBarClass = hot
    ? `transition-all duration-500 ${hotBarClass}`
    : "transition-all duration-500 dark:bg-white/50"
  const subjectBarFill = hot ? hotColor : BAR_SUBJECT_NEUTRAL_FILL

  return (
    <div
      data-testid={`indicator-row-${row.key}`}
      data-hot={hot ? "true" : "false"}
      data-neutral={row.neutral === true ? "true" : "false"}
      className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-8"
    >
      {/* LEFT HALF — label | subject value | reference value | hint. */}
      <div className="flex items-baseline gap-4 sm:flex-1 sm:gap-5">
        <span className="w-44 shrink-0 text-sm font-medium leading-snug text-text-secondary sm:w-52">
          {row.label}
        </span>
        <span
          data-testid={`subject-value-${row.key}`}
          className={subjectValueClass}
          style={subjectValueStyle}
        >
          {bar.studentDisplay}
        </span>
        <span className="w-20 shrink-0 whitespace-nowrap text-xs text-text-muted tabular-nums sm:w-24">
          {referencePrefix} {bar.unitDisplay}
        </span>
        {showHint ? <ComparisonHint bar={bar} /> : null}
      </div>

      {/* RIGHT HALF — subject bar (heavier) over reference rail (lighter). Fully
          inline so the LIGHT theme never loses the bars to stale CSS; dark:
          classes ride on top as enhancement. */}
      <div
        className="sm:flex-1"
        style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 0%", minWidth: 0 }}
      >
        <div
          className="w-full overflow-hidden dark:bg-white/10"
          style={{ height: 6, borderRadius: 9999, backgroundColor: BAR_TRACK_BG }}
        >
          <div
            className={subjectBarClass}
            style={{
              height: "100%",
              borderRadius: 9999,
              width: `${bar.studentWidthPct}%`,
              backgroundColor: subjectBarFill,
            }}
          />
        </div>
        <div
          className="w-full overflow-hidden dark:bg-white/10"
          style={{ height: 6, borderRadius: 9999, backgroundColor: BAR_TRACK_BG }}
        >
          <div
            className="transition-all duration-500 dark:bg-white/25"
            style={{
              height: "100%",
              borderRadius: 9999,
              width: `${bar.unitWidthPct}%`,
              backgroundColor: BAR_REFERENCE_FILL,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// IndicatorComparisonTable — the exported spine. Pure presentation.
// ---------------------------------------------------------------------------

/**
 * Renders the indicator-by-row comparison. Same component for aluno and gestor.
 *
 * - AC1: one row per IndicatorRow, reusing `toMetricBar` for the bar geometry.
 * - AC2/AC3: hot color only where `highlight` (and not `neutral`, and biome
 *   scheme); "abaixo" is neutral grey, never red; `neutral` rows are never colored.
 * - AC4/AC8: `suppressComparison` hides the directional hint; no relative % ever.
 * - AC5: the reference rail/value is always lighter than the subject.
 * - AC6: `colorScheme: "neutral"` disables biome color even on `highlight` rows.
 * - AC7: props bind to a generic subject/reference pair, not to "aluno".
 */
export function IndicatorComparisonTable({
  rows,
  subjectLabel,
  referenceLabel,
  suppressComparison = false,
  colorScheme = "biome",
}: IndicatorComparisonTableProps) {
  const resolved = rows.map((row) => resolveRow(row, colorScheme))

  return (
    <div data-testid="indicator-comparison-table">
      {/* Legend — names the two rails using the generic subject/reference labels.
          Hidden below sm to match the row layout (bars hide on mobile). */}
      <div className="mb-4 hidden items-baseline justify-end text-xs text-text-muted sm:flex">
        <span>
          barra superior: {subjectLabel} · inferior: {referenceLabel}
        </span>
      </div>
      <div className="space-y-4">
        {resolved.map((r) => (
          <IndicatorRowView key={r.row.key} resolved={r} suppressComparison={suppressComparison} />
        ))}
      </div>
    </div>
  )
}
