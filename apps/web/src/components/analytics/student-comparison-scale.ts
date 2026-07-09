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

// ---------------------------------------------------------------------------
// Graded verdict + coach copy — pure, testable. Drives the hero panel headline
// and the coaching sentence (hero + next-step footer). No AI: a deterministic
// template chosen from the data (the metric with the worst RELATIVE delta = the
// clearest "next gain"). See student-comparison.tsx for the visual layer.
// ---------------------------------------------------------------------------

/** Where the student sits vs the unit average, in three graded bands. */
export type VerdictLevel = "above" | "partial" | "below"

/** The headline + coaching copy for the hero panel and the next-step footer. */
export interface Verdict {
  /** Graded band, derived from how many metrics the student leads on. */
  level: VerdictLevel
  /** Hero headline ("Você está acima da média", etc.). */
  headline: string
  /**
   * Coaching sentence pointing at the NEXT concrete gain. Derived from the
   * metric with the worst relative delta (the biggest gap to close), so it
   * reads like a trainer, not a generic banner.
   */
  coachLine: string
  /** Short contextual suggestion for the dark next-step bar footer. */
  nextStep: string
  /** Key of the metric the coaching copy is built around (null when none). */
  focusKey: string | null
}

/**
 * The metric that best defines the student's NEXT gain: the one with the worst
 * signed relative delta (most below average). Rows with `deltaPct === null`
 * (média = 0, no meaningful comparison) are ignored. When every row is at or
 * above average, returns the SMALLEST positive delta (the thinnest lead — the
 * easiest place to slip), so the coach still has something concrete to say.
 * Returns null only when there are no comparable rows at all.
 */
export function pickFocusMetric(bars: MetricBar[]): MetricBar | null {
  const comparable = bars.filter((b) => b.deltaPct !== null)
  if (comparable.length === 0) return null

  const behind = comparable.filter((b) => (b.deltaPct as number) < 0)
  const pool = behind.length > 0 ? behind : comparable
  // Worst (most negative) delta first; ties resolved by original order.
  return pool.reduce((worst, b) =>
    (b.deltaPct as number) < (worst.deltaPct as number) ? b : worst,
  )
}

/**
 * Per-metric coaching template. Keyed by the metric `key` (see buildMetrics in
 * student-comparison.tsx). `strong` = student already leads this dimension;
 * `weak` = it is the gap to close. Deliberately concrete, trainer-voiced, and
 * free of em dashes (house rule). Four metrics × two moods = the template bank.
 */
const COACH_TEMPLATES: Record<string, { strong: string; weak: string; step: string }> = {
  sessions: {
    strong:
      "Seu ritmo está forte. O próximo ganho não é fazer mais coisas, é transformar esse ritmo em reflexões melhores.",
    weak: "Você está entrando menos que a média. Retomar um ritmo constante de sessões é o próximo passo.",
    step: "faça a próxima sessão para manter o ritmo.",
  },
  active: {
    strong:
      "Sua consistência nos últimos 30 dias é exemplar. Mantenha a frequência e foque na profundidade.",
    weak: "Sua atividade nos últimos 30 dias caiu abaixo da média. Voltar à rotina é o próximo passo.",
    step: "volte hoje para reativar sua sequência.",
  },
  "completed-sessions": {
    strong:
      "Você conclui bem o que começa. O próximo ganho é aprofundar cada sessão com uma boa reflexão.",
    weak: "Você inicia mais do que conclui. Fechar as sessões abertas é o próximo passo.",
    step: "conclua uma sessão que ficou em aberto.",
  },
  reflections: {
    strong:
      "Suas reflexões estão acima da média. Continue registrando o que aprende ao final de cada sessão.",
    weak: "Suas reflexões estão abaixo do seu ritmo de estudo. Escrever ao final de cada sessão é o próximo ganho.",
    step: "faça a próxima sessão e escreva uma reflexão curta ao final.",
  },
  completion: {
    strong: "Sua conclusão está acima da média. Mantenha a cadência para consolidar o aprendizado.",
    weak: "Sua conclusão está abaixo da média. Avançar nas sessões pendentes é o próximo passo.",
    step: "avance na próxima sessão da sua trilha.",
  },
}

/** Fallback copy when there is no comparable metric to anchor on. */
const COACH_FALLBACK = {
  above: {
    coachLine:
      "Você está à frente da sua unidade. Mantenha a cadência para consolidar o aprendizado.",
    step: "faça a próxima sessão para manter o ritmo.",
  },
  partial: {
    coachLine:
      "Você já lidera em parte das dimensões. Um passo de cada vez fecha a distância no resto.",
    step: "faça a próxima sessão da sua trilha.",
  },
  below: {
    coachLine:
      "Cada sessão concluída aproxima você da média da sua unidade. O próximo passo é começar.",
    step: "faça a próxima sessão da sua trilha.",
  },
} as const

const HEADLINES: Record<VerdictLevel, string> = {
  above: "Você está acima da média",
  partial: "Você está parcialmente acima da média",
  below: "Você está abaixo da média",
}

/**
 * Build the graded verdict for the hero panel + next-step footer.
 *
 * Band logic (matches countLeads semantics):
 *   • above   → student leads EVERY comparable dimension
 *   • partial → student leads at least half (but not all)
 *   • below   → student leads fewer than half
 *
 * The coaching sentence is anchored on `pickFocusMetric`: when the student is
 * not fully ahead, it names the weakest dimension (the gap to close); when the
 * student is fully ahead, it names the thinnest lead in a "keep pushing" voice.
 */
export function buildVerdict(bars: MetricBar[]): Verdict {
  const total = bars.length
  const leads = countLeads(bars)
  const level: VerdictLevel =
    total > 0 && leads === total ? "above" : leads >= Math.ceil(total / 2) ? "partial" : "below"

  const focus = pickFocusMetric(bars)

  if (!focus) {
    const fb = COACH_FALLBACK[level]
    return {
      level,
      headline: HEADLINES[level],
      coachLine: fb.coachLine,
      nextStep: fb.step,
      focusKey: null,
    }
  }

  const template = COACH_TEMPLATES[focus.key] ?? COACH_TEMPLATES.completion
  // "weak" mood when the focus metric is at/below average (a real gap or the
  // thinnest lead reads better as "keep it up"); "strong" when clearly ahead.
  const mood = focus.deltaPct !== null && focus.deltaPct > 0 ? "strong" : "weak"

  return {
    level,
    headline: HEADLINES[level],
    coachLine: template[mood],
    nextStep: template.step,
    focusKey: focus.key,
  }
}
