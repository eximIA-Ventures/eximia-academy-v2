import { z } from "zod"

// --- Search Queries Schema ---

export const enricherSearchQueriesSchema = z.object({
  queries: z
    .array(
      z.object({
        query: z.string().min(5),
        intent: z.string().min(5),
        target_gap: z.string().min(5),
      }),
    )
    .min(1)
    .max(5),
})

export type EnricherSearchQueries = z.infer<typeof enricherSearchQueriesSchema>

// --- Evaluation Schema ---

export const enricherEvaluationSchema = z.object({
  sources: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
      snippet: z.string(),
      relevance_score: z.number().min(0).max(1),
      rationale: z.string(),
      recommended_action: z.enum(["incorporate", "reference", "discard"]),
    }),
  ),
})

export type EnricherEvaluation = z.infer<typeof enricherEvaluationSchema>

// --- Incorporate Schema ---

export const enricherIncorporateSchema = z.object({
  rewritten_content: z.string().min(50),
  changes_summary: z.string(),
  sources_used: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
      how_used: z.string(),
    }),
  ),
})

export type EnricherIncorporateOutput = z.infer<typeof enricherIncorporateSchema>
