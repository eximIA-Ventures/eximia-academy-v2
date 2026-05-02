import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { getFrameworkConfig } from "./framework-registry"
import { buildArchitectPrompt } from "./prompts/architect"
import type { AnalyzerOutput } from "./schemas/analyzer"
import { type ArchitectOutput, architectOutputSchema } from "./schemas/architect"
import type { CourseDesignerInput } from "./schemas/input"
import type { FrameworkId } from "./schemas/shared"

/**
 * Architect Agent — Fase 2 (Algorithms A4, A5, A6, A7)
 *
 * A4: Objective Generator — ABCD format with Bloom level per module
 * A5: Assessment Designer — Backward Design, 1:1 alignment, Kirkpatrick L1-L4
 * A6: Module Sequencer — Bloom ascending, spiral curriculum, prerequisites
 * A7: Framework Mapper — applies framework stages to each module
 *
 * Also generates Problema-Motor with tension formula and assigns interaction_type
 * via bloom_mapped strategy with spiral_level adjustments.
 *
 * @param input - Original course designer input
 * @param analyzerOutput - Output from the Analyzer agent (Fase 1)
 * @param model - LanguageModel instance (provided by Model Router via orchestrator)
 * @param revisionFeedback - Optional feedback from Quality Gate for auto-retry (D14)
 * @returns ArchitectOutput - Zod-validated course architecture
 */
export async function runArchitect(
  input: CourseDesignerInput,
  analyzerOutput: AnalyzerOutput,
  model: LanguageModel,
  revisionFeedback?: string,
): Promise<ArchitectOutput> {
  const frameworkConfig = getFrameworkConfig(
    analyzerOutput.selected_framework.primary as FrameworkId,
  )

  const result = await generateObject({
    model,
    schema: architectOutputSchema,
    prompt: buildArchitectPrompt(input, analyzerOutput, frameworkConfig, revisionFeedback),
  })

  return result.object
}
