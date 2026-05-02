import type { ArchitectOutput } from "./schemas/architect"
import type { CalculatorOutput } from "./schemas/calculator"

/**
 * Neuroscience Layer — 7 rules based on CLT (Sweller), AGES (NeuroLeadership Institute),
 * Spacing Effect, Retrieval Practice, and Dual Coding Theory.
 *
 * Weights sum to 100.
 */

export interface NeuroscienceRuleResult {
  id: string
  name: string
  passed: boolean
  weight: number
  details: string
}

export interface NeuroscienceResult {
  total: number
  rules: NeuroscienceRuleResult[]
}

/**
 * N1: CLT — chunk_size ≤ 5 new concepts per module (weight: 20)
 */
function evaluateN1(calculatorOutput: CalculatorOutput): NeuroscienceRuleResult {
  const violations = calculatorOutput.cognitive_load.modules.filter((m) => m.new_concepts_count > 5)
  const passed = violations.length === 0
  return {
    id: "N1",
    name: "CLT chunk_size ≤ 5 concepts",
    passed,
    weight: 20,
    details: passed
      ? "All modules have ≤ 5 new concepts"
      : `${violations.length} module(s) exceed 5 new concepts: ${violations.map((v) => `M${v.module_order}(${v.new_concepts_count})`).join(", ")}`,
  }
}

/**
 * N2: AGES Attention — no continuous chunk > 30min without pause (weight: 15)
 */
function evaluateN2(calculatorOutput: CalculatorOutput): NeuroscienceRuleResult {
  const violations: string[] = []
  for (const mod of calculatorOutput.time_allocation.modules) {
    for (const chunk of mod.chunks) {
      if (chunk.duration_min > 30) {
        violations.push(`M${mod.module_order}: "${chunk.title}" (${chunk.duration_min}min)`)
      }
    }
  }
  const passed = violations.length === 0
  return {
    id: "N2",
    name: "AGES attention < 30min without pause",
    passed,
    weight: 15,
    details: passed
      ? "All chunks are ≤ 30 minutes"
      : `Chunks exceeding 30min: ${violations.join("; ")}`,
  }
}

/**
 * N3: AGES Generation — ≥ 1 activity per module (weight: 20)
 */
function evaluateN3(calculatorOutput: CalculatorOutput): NeuroscienceRuleResult {
  const violations: number[] = []
  for (const mod of calculatorOutput.time_allocation.modules) {
    const hasActivity = mod.chunks.some(
      (c) => c.type === "activity" || c.type === "assessment" || c.type === "reflection",
    )
    if (!hasActivity) {
      violations.push(mod.module_order)
    }
  }
  const passed = violations.length === 0
  return {
    id: "N3",
    name: "AGES generation ≥ 1 activity/module",
    passed,
    weight: 20,
    details: passed
      ? "All modules have at least 1 activity"
      : `Modules without activities: ${violations.join(", ")}`,
  }
}

/**
 * N4: AGES Emotion — ≥ 50% modules with emotional hook/problema_motor (weight: 10)
 */
function evaluateN4(architectOutput: ArchitectOutput): NeuroscienceRuleResult {
  const totalModules = architectOutput.modules.length
  const modulesWithHook = architectOutput.modules.filter((m) => m.problema_motor !== null).length
  const percentage = totalModules > 0 ? (modulesWithHook / totalModules) * 100 : 0
  const passed = percentage >= 50
  return {
    id: "N4",
    name: "AGES emotion ≥ 50% modules with hook",
    passed,
    weight: 10,
    details: passed
      ? `${modulesWithHook}/${totalModules} modules (${Math.round(percentage)}%) have emotional hooks`
      : `Only ${modulesWithHook}/${totalModules} modules (${Math.round(percentage)}%) have emotional hooks, need ≥ 50%`,
  }
}

/**
 * N5: Spacing — schedule de revisão se curso > 4h (weight: 15)
 */
function evaluateN5(calculatorOutput: CalculatorOutput): NeuroscienceRuleResult {
  const totalHours = calculatorOutput.time_allocation.total_minutes / 60
  if (totalHours <= 4) {
    return {
      id: "N5",
      name: "Spacing schedule if > 4h",
      passed: true,
      weight: 15,
      details: "Course ≤ 4h, spacing not required",
    }
  }
  const hasSpacing = calculatorOutput.pacing_strategy.spaced_repetition_points.length > 0
  return {
    id: "N5",
    name: "Spacing schedule if > 4h",
    passed: hasSpacing,
    weight: 15,
    details: hasSpacing
      ? `${calculatorOutput.pacing_strategy.spaced_repetition_points.length} spaced repetition points defined`
      : "Course > 4h but no spaced repetition points defined",
  }
}

/**
 * N6: Retrieval — ≥ 1 formative quiz per module (weight: 15)
 */
function evaluateN6(architectOutput: ArchitectOutput): NeuroscienceRuleResult {
  const violations: number[] = []
  for (const mod of architectOutput.modules) {
    const hasFormative = mod.assessments.some((a) => a.type === "formative")
    if (!hasFormative) {
      violations.push(mod.order)
    }
  }
  const passed = violations.length === 0
  return {
    id: "N6",
    name: "Retrieval ≥ 1 formative quiz/module",
    passed,
    weight: 15,
    details: passed
      ? "All modules have at least 1 formative assessment"
      : `Modules without formative assessment: ${violations.join(", ")}`,
  }
}

/**
 * N7: Dual Coding — visual + textual material (weight: 5)
 * Since we're at the blueprint level (no actual content yet), we check if
 * chunk types include variety (content + activity) which implies multimodal delivery.
 */
function evaluateN7(calculatorOutput: CalculatorOutput): NeuroscienceRuleResult {
  const violations: number[] = []
  for (const mod of calculatorOutput.time_allocation.modules) {
    const types = new Set(mod.chunks.map((c) => c.type))
    const hasVariety = types.size >= 2
    if (!hasVariety) {
      violations.push(mod.module_order)
    }
  }
  const passed = violations.length === 0
  return {
    id: "N7",
    name: "Dual Coding visual + textual",
    passed,
    weight: 5,
    details: passed
      ? "All modules have varied chunk types (multimodal)"
      : `Modules with single chunk type: ${violations.join(", ")}`,
  }
}

/**
 * Evaluates all 7 neuroscience rules and returns weighted score.
 *
 * @param architectOutput - Output from Architect agent
 * @param calculatorOutput - Output from Calculator agent
 * @returns NeuroscienceResult with total score (0-100) and per-rule results
 */
export function evaluateNeuroscienceRules(
  architectOutput: ArchitectOutput,
  calculatorOutput: CalculatorOutput,
): NeuroscienceResult {
  const rules: NeuroscienceRuleResult[] = [
    evaluateN1(calculatorOutput),
    evaluateN2(calculatorOutput),
    evaluateN3(calculatorOutput),
    evaluateN4(architectOutput),
    evaluateN5(calculatorOutput),
    evaluateN6(architectOutput),
    evaluateN7(calculatorOutput),
  ]

  // Weighted score: sum of (passed ? weight : 0) since weights sum to 100
  const total = rules.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)

  return { total, rules }
}
