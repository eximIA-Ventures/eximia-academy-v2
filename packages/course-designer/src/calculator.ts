import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { getFrameworkConfig } from "./framework-registry"
import { buildCalculatorPrompt } from "./prompts/calculator"
import type { ArchitectOutput } from "./schemas/architect"
import { type CalculatorOutput, calculatorOutputSchema } from "./schemas/calculator"
import type { FrameworkId } from "./schemas/shared"

/**
 * Calculator Agent — Fase 3 (Algorithms A8, A9, A10)
 *
 * A8: Duration Allocator — distributes total_duration_hours among modules and stages
 * A9: Cognitive Load Analyzer — evaluates CLT (Sweller) compliance
 * A10: Chunk Optimizer — divides modules into 5-30min chunks respecting AGES rules
 *
 * Post-LLM validation ensures time sums are mathematically correct.
 *
 * @param architectOutput - Output from the Architect agent (Fase 2)
 * @param totalDurationHours - Total course duration in hours
 * @param frameworkId - Framework ID to get stage time percentages
 * @param model - LanguageModel instance (provided by Model Router via orchestrator)
 * @returns CalculatorOutput - Zod-validated time allocation and cognitive load analysis
 */
export async function runCalculator(
  architectOutput: ArchitectOutput,
  totalDurationHours: number,
  frameworkId: FrameworkId,
  model: LanguageModel,
): Promise<CalculatorOutput> {
  const frameworkConfig = getFrameworkConfig(frameworkId)

  const result = await generateObject({
    model,
    schema: calculatorOutputSchema,
    prompt: buildCalculatorPrompt(architectOutput, totalDurationHours, frameworkConfig),
  })

  const output = result.object

  // Post-LLM validation: verify time sums are mathematically correct
  validateTimeSums(output, totalDurationHours)

  return output
}

/**
 * Programmatic post-LLM validation for time consistency.
 * Throws if total module minutes deviate more than 5% from expected.
 */
function validateTimeSums(output: CalculatorOutput, totalDurationHours: number): void {
  const expectedMinutes = totalDurationHours * 60
  const tolerance = expectedMinutes * 0.05

  const totalModuleMinutes = output.time_allocation.modules.reduce(
    (sum, m) => sum + m.total_minutes,
    0,
  )

  if (Math.abs(totalModuleMinutes - expectedMinutes) > tolerance) {
    throw new Error(
      `Time allocation mismatch: modules sum to ${totalModuleMinutes}min but expected ${expectedMinutes}min (±5% = ${tolerance}min)`,
    )
  }

  // Validate chunk sums per module
  for (const mod of output.time_allocation.modules) {
    const chunkSum = mod.chunks.reduce((sum, c) => sum + c.duration_min, 0)
    const moduleTolerance = mod.total_minutes * 0.05
    if (Math.abs(chunkSum - mod.total_minutes) > moduleTolerance) {
      throw new Error(
        `Module ${mod.module_order} chunk time mismatch: chunks sum to ${chunkSum}min but module total is ${mod.total_minutes}min`,
      )
    }
  }
}
