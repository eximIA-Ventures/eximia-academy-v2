import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { buildGeneratorPrompt } from "./prompts/generator"
import type { AnalyzerOutput } from "./schemas/analyzer"
import type { ArchitectOutput } from "./schemas/architect"
import type { CalculatorOutput } from "./schemas/calculator"
import { type Blueprint, blueprintSchema } from "./schemas/generator"
import type { ValidatorOutput } from "./schemas/validator"

/**
 * Generator Agent — Fase 5 (Algorithms A15, A16)
 *
 * A15: Blueprint Builder — consolidates all pipeline outputs into final JSON
 * A16: Activity Recommender — suggests activities per stage from ACTIVITY_BANK
 *
 * Sets requires_instructor_review flag if verdict is needs_revision or poor.
 *
 * @param analyzerOutput - Output from Analyzer agent (Fase 1)
 * @param architectOutput - Output from Architect agent (Fase 2)
 * @param calculatorOutput - Output from Calculator agent (Fase 3)
 * @param validatorOutput - Output from Validator agent (Fase 4)
 * @param courseTitle - Original course title
 * @param language - Output language
 * @param interactionStrategy - Interaction strategy chosen
 * @param totalDurationHours - Total course duration in hours
 * @param model - LanguageModel instance (provided by Model Router via orchestrator)
 * @returns Blueprint - Complete course blueprint
 */
export async function runGenerator(
  analyzerOutput: AnalyzerOutput,
  architectOutput: ArchitectOutput,
  calculatorOutput: CalculatorOutput,
  validatorOutput: ValidatorOutput,
  courseTitle: string,
  language: "pt-br" | "en",
  interactionStrategy: "bloom_mapped" | "dominant" | "custom",
  totalDurationHours: number,
  audienceRole: string,
  model: LanguageModel,
): Promise<Blueprint> {
  const result = await generateObject({
    model,
    schema: blueprintSchema,
    prompt: buildGeneratorPrompt(
      analyzerOutput,
      architectOutput,
      calculatorOutput,
      validatorOutput,
      courseTitle,
      language,
      interactionStrategy,
      totalDurationHours,
      audienceRole,
    ),
  })

  const blueprint = result.object

  // Ensure requires_instructor_review is set correctly
  blueprint.requires_instructor_review =
    validatorOutput.verdict === "needs_revision" || validatorOutput.verdict === "poor"

  return blueprint
}
