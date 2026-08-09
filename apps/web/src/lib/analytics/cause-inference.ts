// ---------------------------------------------------------------------------
// Cause Inference — FASE 2 (Spike 8.2 caveat closer) · PURE lib, no fetch
// ---------------------------------------------------------------------------
// Closes the open caveat of spike 8.2: when two comparable entities differ, a
// gestor sees WHICH one wins but not WHY, nor WHAT to do about it. This module
// performs a DETERMINISTIC, threshold-driven inference of the probable cause of
// the gap between two entities and emits an ACTIONABLE recommendation per
// significant dimension. NO AI, NO heuristics-of-the-day, NO closed diagnosis —
// every output is explicitly a RECOMENDAÇÃO (a hypothesis to act on), never a
// statement of fact.
//
// SCOPE (decisions enforced):
//   • Pure: receives two metric blocks, returns a result. Zero I/O, fully
//     testable, no Date.now, no Supabase, no React.
//   • Additive: the gestor consumes this WITHOUT being role-gated — the caller
//     decides when to render; this lib never gates.
//   • Serves the THREE views by construction: it operates on the shared metric
//     block (`Omit<UnitStats,"areaName">`) that UnitStats / AreaStats /
//     ManagerStats all extend (see area-gestor.ts computeMetricBlock), so the
//     same call works for unit×unit, área×área or gestor×gestor.
//
// DIMENSIONS — FASE 2 completes the framework to FIVE measurable dimensions
// (Hugo's binding decision for item 8.2). All deterministic, no AI:
//   • ATIVAÇÃO            — % of students active in the last 30d (active/total).
//   • REFLEXÃO            — reflection intensity (reflections per student) — the
//                           closest per-capita proxy without a reflectionPotential.
//   • CONCLUSÃO           — completion rate (completionPct, already 0–100).
//   • PROFUNDIDADE        — avg session depth reached (avgDepth, 0–N). NEW in
//                           FASE 2; data already derived by /api/analytics/aggregate.
//   • CONCLUSÃO CONSCIENTE — % of students who BOTH completed AND wrote a reflection
//                           (consciousCompletionPct, 0–100). NEW in FASE 2.
//
// The two new dimensions are read from OPTIONAL fields on the shared metric block
// (avgDepth, consciousCompletionPct). When EITHER side lacks the field, that
// dimension is SKIPPED entirely (never throws, never asserted) — older payloads
// that predate the producers keep working unchanged.
//
// "LIDERANÇA LOCAL" stays NON-measurable: there is no direct metric for it, so it
// is emitted ONLY as a labeled `phase2Hypotheses` string ("[hipótese] ... não
// confirmado") when one side leads broadly in a way the five dimensions don't
// fully explain — NEVER as a dimension, a cause, or a recommendation.

import type { UnitStats } from "@/types/analytics"

// ---------------------------------------------------------------------------
// Shared metric block — the field-for-field common shape of UnitStats /
// AreaStats / ManagerStats. Defined as Omit so any of the three (and any future
// stat sharing the block) is accepted by construction. This is the EXACT output
// of area-gestor.ts `computeMetricBlock`, so the views agree with the engine.
// ---------------------------------------------------------------------------
export type ComparableMetrics = Omit<UnitStats, "areaName">

/** The five dimensions analyzed. Stable string union for the UI to switch on. */
export type CauseDimension =
  | "ativacao"
  | "reflexao"
  | "conclusao"
  | "profundidade"
  | "conclusao_consciente"

/** Human-facing pt-BR labels for each dimension (UI-ready, no extra mapping). */
export const CAUSE_DIMENSION_LABELS: Record<CauseDimension, string> = {
  ativacao: "ativação",
  reflexao: "reflexão",
  conclusao: "conclusão",
  profundidade: "profundidade",
  conclusao_consciente: "conclusão consciente",
}

/**
 * Tie-break priority when two dimensions have an equal gap magnitude. Lower wins
 * (surfaces first). The order reflects the learning funnel — show up (ativação) →
 * engage (reflexão) → finish (conclusão) → finish well (conclusão consciente) →
 * go deep (profundidade) — so equal-gap ties resolve in a stable, legible order.
 */
const DIMENSION_PRIORITY: Record<CauseDimension, number> = {
  ativacao: 0,
  reflexao: 1,
  conclusao: 2,
  conclusao_consciente: 3,
  profundidade: 4,
}

/**
 * Significance thresholds per dimension. A gap below the threshold is treated as
 * NOISE and produces no recommendation (avoids crying "cause" over rounding).
 * Tuned conservatively — only meaningful, actionable gaps surface. Overridable
 * via {@link inferCause} options so tests / future tuning don't fork the code.
 */
export interface CauseThresholds {
  /** Min |Δ| in percentage points for ATIVAÇÃO (active %) to be significant. */
  ativacaoPp: number
  /** Min |Δ| in percentage points for CONCLUSÃO (completion %) to be significant. */
  conclusaoPp: number
  /**
   * Min |Δ| in reflections-per-student for REFLEXÃO to be significant. Expressed
   * per-capita (not raw count) so a larger team isn't flagged just for size.
   */
  reflexaoPerStudent: number
  /**
   * Min |Δ| in depth levels for PROFUNDIDADE (avgDepth) to be significant.
   * avgDepth is a 0–N depth-level scale (same number the aggregate route derives
   * from session_analytics.depth_reached), so a 0.5-level gap is the smallest
   * difference worth flagging — below it is rounding/noise.
   */
  profundidadeLevels: number
  /**
   * Min |Δ| in percentage points for CONCLUSÃO CONSCIENTE (concluiu + refletiu %)
   * to be significant. Same 0–100 scale as completion, so reuse the same 10pp bar.
   */
  conclusaoConscientePp: number
}

export const DEFAULT_CAUSE_THRESHOLDS: CauseThresholds = {
  ativacaoPp: 10,
  conclusaoPp: 10,
  reflexaoPerStudent: 0.5,
  profundidadeLevels: 0.5,
  conclusaoConscientePp: 10,
}

/** Options for {@link inferCause}. All optional; sensible defaults applied. */
export interface InferCauseOptions {
  /** Override significance thresholds (e.g. for tests or per-tenant tuning). */
  thresholds?: Partial<CauseThresholds>
}

/**
 * One significant, DIRECTED difference between the two entities on a single
 * dimension. `leader` is the entity ahead; `value`/`unit` describe the gap.
 */
export interface CauseDifference {
  dimension: CauseDimension
  /** pt-BR dimension label (mirrors CAUSE_DIMENSION_LABELS). */
  dimensionLabel: string
  /** "a" if entity A leads on this dimension, "b" otherwise. */
  leader: "a" | "b"
  /** Display name of the leading entity (echoed from input). */
  leaderName: string
  /** Display name of the trailing entity (echoed from input). */
  trailingName: string
  /** Magnitude of the gap (always ≥ 0). */
  gap: number
  /**
   * Unit of {@link gap}: "pp" (percentage points), "perStudent"
   * (reflections per student) or "depth" (avg depth levels, for PROFUNDIDADE).
   */
  unit: "pp" | "perStudent" | "depth"
  /**
   * ACTIONABLE recommendation, pt-BR, in the spike's prescribed form:
   * "{Líder} está {X} {unidade} à frente de {Atrás} em {dimensão} → replicar a
   * prática de {Líder} em {Atrás}." Always framed as a RECOMENDAÇÃO.
   */
  recommendation: string
}

/**
 * Result of a pairwise cause inference between two comparable entities.
 *   • `differences` — the significant, directed gaps + recommendations (v1).
 *   • `phase2Hypotheses` — speculative, clearly-labeled "to investigate" leads
 *     (depth-aware completion, local leadership). NEVER asserted, NEVER a cause.
 *   • `label` — constant marker so the UI renders this as a RECOMMENDATION block,
 *     not a diagnosis.
 */
export interface CauseInferenceResult {
  entityAName: string
  entityBName: string
  differences: CauseDifference[]
  /**
   * Labeled hypotheses only, each prefixed "[hipótese]" and ending "(não
   * confirmado)". The UI MUST render these as "a investigar", never as a
   * conclusion. Notably "liderança local" lives here (not measurable directly),
   * plus a legacy depth/quality flag when PROFUNDIDADE data is absent. Empty when
   * nothing speculative is worth flagging.
   */
  phase2Hypotheses: string[]
  /** Always "recomendacao" — this is advice to act on, not a closed diagnosis. */
  label: "recomendacao"
}

// ---------------------------------------------------------------------------
// Per-dimension extractors — normalize each entity to a comparable scalar.
// ---------------------------------------------------------------------------

/** ATIVAÇÃO as a 0–100 percentage (active ÷ total), 0 when no students. */
function activationPct(m: ComparableMetrics): number {
  return m.totalStudents > 0 ? (m.activeStudents / m.totalStudents) * 100 : 0
}

/** REFLEXÃO as reflections-per-student (per-capita), 0 when no students. */
function reflectionPerStudent(m: ComparableMetrics): number {
  return m.totalStudents > 0 ? m.reflectionCount / m.totalStudents : 0
}

/** CONCLUSÃO is already a 0–100 percentage in the metric block. */
function completionPct(m: ComparableMetrics): number {
  return m.totalStudents > 0 ? m.completionPct : 0
}

/**
 * PROFUNDIDADE as avg depth level (avgDepth, 0–N). Returns `undefined` when the
 * field is absent (older payloads) OR there are no students — either way the
 * dimension must be SKIPPED, never coerced to 0. Guarding totalStudents>0 keeps
 * an empty entity from reading as "0 depth" and faking a gap.
 */
function depthLevel(m: ComparableMetrics): number | undefined {
  if (m.totalStudents <= 0) return undefined
  return typeof m.avgDepth === "number" ? m.avgDepth : undefined
}

/**
 * CONCLUSÃO CONSCIENTE as a 0–100 percentage (concluiu + refletiu). Returns
 * `undefined` when the field is absent OR there are no students, so the
 * dimension is SKIPPED rather than asserted on missing data.
 */
function consciousCompletionPct(m: ComparableMetrics): number | undefined {
  if (m.totalStudents <= 0) return undefined
  return typeof m.consciousCompletionPct === "number" ? m.consciousCompletionPct : undefined
}

// ---------------------------------------------------------------------------
// Recommendation phrasing — single source of truth for the spike's format.
// ---------------------------------------------------------------------------
/** Gap units across the five dimensions. Single alias keeps signatures tidy. */
type MetricUnit = "pp" | "perStudent" | "depth"

function formatGap(gap: number, unit: MetricUnit): string {
  if (unit === "pp") {
    // Percentage-point gaps: whole-ish numbers read best (e.g. "12 pp").
    return `${Math.round(gap)} pp`
  }
  if (unit === "depth") {
    // Depth-level gaps: one decimal (e.g. "0.7 níveis de profundidade").
    return `${gap.toFixed(1)} níveis de profundidade`
  }
  // Per-student gaps: one decimal (e.g. "0.8 reflexões/aluno").
  return `${gap.toFixed(1)} reflexões/aluno`
}

function buildRecommendation(
  leaderName: string,
  trailingName: string,
  dimensionLabel: string,
  gap: number,
  unit: MetricUnit,
): string {
  // Spike-prescribed shape: "A está X à frente de B em {dimensão} → replicar
  // prática de A em B." Framed as a RECOMENDAÇÃO (suggestion), not a verdict.
  return `${leaderName} está ${formatGap(gap, unit)} à frente de ${trailingName} em ${dimensionLabel} → replicar a prática de ${leaderName} em ${trailingName}.`
}

// ---------------------------------------------------------------------------
// Core dimension evaluation — one significant directed diff or null.
// ---------------------------------------------------------------------------
function evaluateDimension(
  dimension: CauseDimension,
  valueA: number,
  valueB: number,
  threshold: number,
  unit: MetricUnit,
  entityAName: string,
  entityBName: string,
): CauseDifference | null {
  const gap = Math.abs(valueA - valueB)
  if (gap <= 0) return null // identical entities → no recommendation
  if (gap < threshold) return null // below significance → treat as noise

  const aLeads = valueA >= valueB
  const leader: "a" | "b" = aLeads ? "a" : "b"
  const leaderName = aLeads ? entityAName : entityBName
  const trailingName = aLeads ? entityBName : entityAName
  const dimensionLabel = CAUSE_DIMENSION_LABELS[dimension]

  return {
    dimension,
    dimensionLabel,
    leader,
    leaderName,
    trailingName,
    gap,
    unit,
    recommendation: buildRecommendation(leaderName, trailingName, dimensionLabel, gap, unit),
  }
}

// ---------------------------------------------------------------------------
// Public API — pure pairwise inference.
// ---------------------------------------------------------------------------

/**
 * Deterministically infers the probable cause(s) of the performance gap between
 * two comparable entities and emits an actionable RECOMMENDATION per significant
 * dimension. PURE — no I/O, no clock, no AI. Identical inputs → identical output.
 *
 * Works for any pair sharing the metric block (UnitStats / AreaStats /
 * ManagerStats), so it serves the three comparison views by construction.
 *
 * @param a          metric block of entity A (the shared `computeMetricBlock` shape)
 * @param entityAName display name of A (echoed into recommendations)
 * @param b          metric block of entity B
 * @param entityBName display name of B
 * @param options    optional threshold overrides
 * @returns          significant directed diffs + phase-2 hypotheses, labeled
 *                   "recomendacao". Differences are sorted by gap magnitude
 *                   (largest first) so the UI surfaces the strongest lever on top.
 */
export function inferCause(
  a: ComparableMetrics,
  entityAName: string,
  b: ComparableMetrics,
  entityBName: string,
  options: InferCauseOptions = {},
): CauseInferenceResult {
  const thresholds: CauseThresholds = { ...DEFAULT_CAUSE_THRESHOLDS, ...options.thresholds }

  const differences: CauseDifference[] = []

  // --- ATIVAÇÃO (active %) ---
  const ativacao = evaluateDimension(
    "ativacao",
    activationPct(a),
    activationPct(b),
    thresholds.ativacaoPp,
    "pp",
    entityAName,
    entityBName,
  )
  if (ativacao) differences.push(ativacao)

  // --- REFLEXÃO (reflections per student) ---
  const reflexao = evaluateDimension(
    "reflexao",
    reflectionPerStudent(a),
    reflectionPerStudent(b),
    thresholds.reflexaoPerStudent,
    "perStudent",
    entityAName,
    entityBName,
  )
  if (reflexao) differences.push(reflexao)

  // --- CONCLUSÃO (completion %) ---
  const conclusao = evaluateDimension(
    "conclusao",
    completionPct(a),
    completionPct(b),
    thresholds.conclusaoPp,
    "pp",
    entityAName,
    entityBName,
  )
  if (conclusao) differences.push(conclusao)

  // --- PROFUNDIDADE (avg depth level) — FASE 2 ---
  // Optional field: evaluate ONLY when BOTH sides carry avgDepth; otherwise SKIP
  // (never coerce a missing value to 0, which would invent a gap).
  const depthA = depthLevel(a)
  const depthB = depthLevel(b)
  if (depthA !== undefined && depthB !== undefined) {
    const profundidade = evaluateDimension(
      "profundidade",
      depthA,
      depthB,
      thresholds.profundidadeLevels,
      "depth",
      entityAName,
      entityBName,
    )
    if (profundidade) differences.push(profundidade)
  }

  // --- CONCLUSÃO CONSCIENTE (concluiu + refletiu %) — FASE 2 ---
  // Optional field: same skip-when-absent rule as PROFUNDIDADE.
  const consciousA = consciousCompletionPct(a)
  const consciousB = consciousCompletionPct(b)
  if (consciousA !== undefined && consciousB !== undefined) {
    const conclusaoConsciente = evaluateDimension(
      "conclusao_consciente",
      consciousA,
      consciousB,
      thresholds.conclusaoConscientePp,
      "pp",
      entityAName,
      entityBName,
    )
    if (conclusaoConsciente) differences.push(conclusaoConsciente)
  }

  // Strongest lever first — compare by raw gap magnitude so the largest absolute
  // difference surfaces on top regardless of unit. When gaps are equal, fall back
  // to a fixed dimension priority so ordering is fully deterministic across all
  // five dimensions (gaps in different units aren't directly commensurable, so a
  // stable, explicit tie-break beats relying on insertion order).
  differences.sort((x, y) => {
    if (y.gap !== x.gap) return y.gap - x.gap
    return DIMENSION_PRIORITY[x.dimension] - DIMENSION_PRIORITY[y.dimension]
  })

  // --- FASE 2 hypotheses (NEVER asserted; speculative leads only) ---
  const phase2Hypotheses = buildPhase2Hypotheses(a, b, entityAName, entityBName, differences)

  return {
    entityAName,
    entityBName,
    differences,
    phase2Hypotheses,
    label: "recomendacao",
  }
}

// ---------------------------------------------------------------------------
// Labeled hypotheses ONLY. Each string is prefixed "[hipótese]" and must be
// rendered as "a investigar / não confirmado". These are NOT causes and NOT
// recommendations.
//
// LIDERANÇA LOCAL is intentionally NOT a dimension: there is no direct metric for
// it. Per Hugo's decision it is emitted here ONLY as a labeled hypothesis, and
// ONLY when one entity leads broadly across the MEASURED dimensions in a way the
// five dimensions don't fully explain (a large, consistent lead). It is NEVER
// asserted as a cause and NEVER turned into a recommendation.
//
// When the new PROFUNDIDADE data is ABSENT (older payloads), we additionally keep
// the legacy depth-quality lead — but only as a hypothesis, since we cannot
// measure profundidade in that case. When depth data IS present, the real
// PROFUNDIDADE dimension supersedes that flag (no duplicate speculation).
// ---------------------------------------------------------------------------

/** A lead is "large/unexplained" when its gap is ≥ this multiple of its threshold. */
const LIDERANCA_GAP_MULTIPLIER = 2

function buildPhase2Hypotheses(
  a: ComparableMetrics,
  b: ComparableMetrics,
  _entityAName: string,
  _entityBName: string,
  differences: CauseDifference[],
): string[] {
  const hypotheses: string[] = []

  const depthAvailable = depthLevel(a) !== undefined && depthLevel(b) !== undefined

  // LEGACY (only when PROFUNDIDADE is NOT measurable): a completion gap with no
  // activation gap MIGHT reflect session depth/quality — flag to investigate.
  // When depth data exists, the real PROFUNDIDADE dimension covers this, so we
  // suppress the flag to avoid duplicate speculation.
  if (!depthAvailable) {
    const hasConclusaoGap = differences.some((d) => d.dimension === "conclusao")
    const hasAtivacaoGap = differences.some((d) => d.dimension === "ativacao")
    if (hasConclusaoGap && !hasAtivacaoGap) {
      hypotheses.push(
        "[hipótese] diferença de conclusão sem diferença de ativação pode indicar profundidade/qualidade das sessões — a investigar com dados de profundidade (não confirmado).",
      )
    }
  }

  // LIDERANÇA LOCAL — labeled hypothesis ONLY. Fires when ONE side leads
  // consistently across ≥2 measured dimensions AND at least one of those leads is
  // LARGE (≥ 2× its significance threshold) — i.e. a broad, pronounced advantage
  // the five dimensions surface but don't causally explain. NEVER a cause.
  const aWinsAll = differences.length >= 2 && differences.every((d) => d.leader === "a")
  const bWinsAll = differences.length >= 2 && differences.every((d) => d.leader === "b")
  if (aWinsAll || bWinsAll) {
    const hasLargeLead = differences.some(
      (d) => d.gap >= LIDERANCA_GAP_MULTIPLIER * thresholdFor(d.dimension),
    )
    if (hasLargeLead) {
      hypotheses.push("[hipótese] possível diferença de liderança local (não confirmado).")
    }
  }

  return hypotheses
}

/**
 * The default significance threshold for a dimension, used only to judge whether
 * a lead is "large" for the liderança-local hypothesis. Reads from the SAME
 * default thresholds the inference uses, so the two stay in sync.
 */
function thresholdFor(dimension: CauseDimension): number {
  switch (dimension) {
    case "ativacao":
      return DEFAULT_CAUSE_THRESHOLDS.ativacaoPp
    case "conclusao":
      return DEFAULT_CAUSE_THRESHOLDS.conclusaoPp
    case "reflexao":
      return DEFAULT_CAUSE_THRESHOLDS.reflexaoPerStudent
    case "profundidade":
      return DEFAULT_CAUSE_THRESHOLDS.profundidadeLevels
    case "conclusao_consciente":
      return DEFAULT_CAUSE_THRESHOLDS.conclusaoConscientePp
  }
}
