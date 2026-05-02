import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { getFrameworkConfig, selectFramework } from "./framework-registry"
import { buildAnalyzerPrompt } from "./prompts/analyzer"
import { type AnalyzerOutput, analyzerOutputSchema } from "./schemas/analyzer"
import type { CourseDesignerInput } from "./schemas/input"
import { courseDesignerInputSchema } from "./schemas/input"
import type { FrameworkId } from "./schemas/shared"

/**
 * Analyzer Agent — Fase 1 (Algorithms A1, A2, A3)
 *
 * A1: Input Parser & Validator — normalizes and validates input
 * A2: Framework Selector — selects framework (auto or user preference)
 * A3: Audience Profiler — LLM infers ZPD, Kolb style, motivation, andragogy
 *
 * @param rawInput - Raw course designer input (will be validated)
 * @param model - LanguageModel instance (provided by Model Router via orchestrator)
 * @returns AnalyzerOutput - Zod-validated analysis result
 */
export async function runAnalyzer(
  rawInput: CourseDesignerInput,
  model: LanguageModel,
): Promise<AnalyzerOutput> {
  // A1: Input Parser & Validator — normalize and validate via Zod schema
  const input = courseDesignerInputSchema.parse(rawInput)

  // A2: Framework Selector — use selectFramework() if auto, otherwise get specific config
  const frameworkConfig =
    input.framework === "auto"
      ? selectFramework({
          behavior_change: input.behavior_change,
          total_duration_hours: input.total_duration_hours,
          experience_level: input.target_audience.experience_level,
        })
      : getFrameworkConfig(input.framework as FrameworkId)

  // A3: Audience Profiler — LLM generates structured analysis
  const result = await generateObject({
    model,
    schema: analyzerOutputSchema,
    prompt: buildAnalyzerPrompt(input, frameworkConfig),
  })

  return result.object
}
