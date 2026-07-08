// ---------------------------------------------------------------------------
// student-comparison-scale — pure, testable proportion + delta logic
// ---------------------------------------------------------------------------
// Extracted from the widget so the "honest scale" (max = larger of the two
// values) and the "média = 0 → no division by zero" rules can be unit-tested
// without rendering React. See student-comparison.tsx for the visual layer.
// ---------------------------------------------------------------------------

/** A single row of the you-vs-average comparison. */
export interface ComparisonMetric {
  /** Stable key for React lists. */
  key: string
  /** Human label shown on the row (pt-BR). */
  label: string
  /** The student's raw value for this metric. */
  studentValue: number
  /** The unit average's raw value for this metric. */
  unitValue: number
  /** How to render the numbers. */
  format: "pct" | "decimal" | "int"
}

/** Derived, render-ready geometry + comparison for one metric row. */
export interface MetricBar {
  key: string
  label: string
  studentValue: number
  unitValue: number
  /** Pre-formatted display strings (pct → "75%", decimal → "13.0", int → "8"). */
  studentDisplay: string
  unitDisplay: string
  /**
   * Bar widths in percent (0–100). HONEST SCALE: the shared denominator is the
   * larger of the two values, so the winning side reaches 100% and the other is
   * strictly proportional. Two different values NEVER render as two full bars.
   */
  studentWidthPct: number
  unitWidthPct: number
  /** true when the student is at or above the unit average. */
  studentAhead: boolean
  /**
   * Signed difference vs the average, expressed as a percentage of the average,
   * rounded. null when the average is 0 (no meaningful relative delta — avoids
   * division by zero and an "∞%" artifact). Positive = above average.
   */
  deltaPct: number | null
}

/** Format a raw metric value for display. */
export function formatMetric(value: number, format: ComparisonMetric["format"]): string {
  if (format === "pct") return `${Math.round(value)}%`
  if (format === "decimal") return value.toFixed(1)
  return String(Math.round(value))
}

/**
 * Turn a raw metric into render-ready bar geometry.
 *
 * HONEST SCALE: `max = Math.max(studentValue, unitValue)`. Each side's width is
 * its value ÷ max × 100, so:
 *   • the larger value fills the bar (100%),
 *   • the smaller value is drawn strictly to scale,
 *   • equal values render two equal bars,
 *   • 8 vs 4 renders 100% vs 50% — never "both full".
 * When BOTH values are 0, both widths are 0 (empty, honest — nothing happened).
 *
 * DELTA vs média: signed, relative to the average, rounded. Guarded so a média
 * of 0 yields `deltaPct === null` (no division by zero).
 */
export function toMetricBar(metric: ComparisonMetric): MetricBar {
  const { studentValue, unitValue } = metric
  const max = Math.max(studentValue, unitValue)

  const studentWidthPct = max > 0 ? (studentValue / max) * 100 : 0
  const unitWidthPct = max > 0 ? (unitValue / max) * 100 : 0

  const deltaPct = unitValue > 0 ? Math.round(((studentValue - unitValue) / unitValue) * 100) : null

  return {
    key: metric.key,
    label: metric.label,
    studentValue,
    unitValue,
    studentDisplay: formatMetric(studentValue, metric.format),
    unitDisplay: formatMetric(unitValue, metric.format),
    studentWidthPct,
    unitWidthPct,
    studentAhead: studentValue >= unitValue,
    deltaPct,
  }
}

/** Number of metrics where the student is at or above the average. */
export function countLeads(bars: MetricBar[]): number {
  return bars.filter((b) => b.studentAhead).length
}
