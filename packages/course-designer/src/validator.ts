import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { evaluateNeuroscienceRules } from "./neuroscience-rules"
import { buildValidatorPrompt } from "./prompts/validator"
import type { AnalyzerOutput } from "./schemas/analyzer"
import type { ArchitectOutput } from "./schemas/architect"
import type { CalculatorOutput } from "./schemas/calculator"
import type { QualityVerdict } from "./schemas/shared"
import { type ValidatorOutput, qualityScorecardSchema } from "./schemas/validator"

/**
 * Validator Agent — Fase 4 (Algorithms A11, A12, A13, A14)
 *
 * A11: Alignment Checker — verifies 1:1 objective-assessment mapping
 * A12: Bloom Progression Validator — no drops > 1 level
 * A13: Completeness Auditor — all framework stages present
 * A14: Quality Scorecard — framework_score (70%) + neuroscience_score (30%) = final_score
 *
 * The framework_score is LLM-evaluated, while neuroscience_score is programmatic.
 *
 * @param analyzerOutput - Output from Analyzer agent (Fase 1)
 * @param architectOutput - Output from Architect agent (Fase 2)
 * @param calculatorOutput - Output from Calculator agent (Fase 3)
 * @param model - LanguageModel instance (provided by Model Router via orchestrator)
 * @returns ValidatorOutput - Quality Scorecard with final score and verdict
 */
export async function runValidator(
  analyzerOutput: AnalyzerOutput,
  architectOutput: ArchitectOutput,
  calculatorOutput: CalculatorOutput,
  model: LanguageModel,
): Promise<ValidatorOutput> {
  // Step 1: LLM evaluates framework score
  const llmResult = await generateObject({
    model,
    schema: qualityScorecardSchema,
    prompt: buildValidatorPrompt(analyzerOutput, architectOutput, calculatorOutput),
  })

  const scorecard = llmResult.object

  // Step 2: Programmatic neuroscience evaluation
  const neuroResult = evaluateNeuroscienceRules(architectOutput, calculatorOutput)

  // Step 3: Override neuroscience_score with programmatic result
  scorecard.neuroscience_score = {
    total: neuroResult.total,
    rules: neuroResult.rules,
  }

  // Step 4: Recalculate final_score with correct weights
  const frameworkWeighted = scorecard.framework_score.total * 0.7
  const neuroscienceWeighted = neuroResult.total * 0.3
  scorecard.final_score = Math.round(frameworkWeighted + neuroscienceWeighted)

  // Step 5: Recalculate verdict based on corrected final_score
  scorecard.verdict = getVerdict(scorecard.final_score)

  return scorecard
}

function getVerdict(score: number): QualityVerdict {
  if (score >= 90) return "excellent"
  if (score >= 70) return "good"
  if (score >= 50) return "needs_revision"
  return "poor"
}
