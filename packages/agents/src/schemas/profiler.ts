import { z } from "zod"

// --- Input Schema ---

export const profilerInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        turn_number: z.number().int(),
      }),
    )
    .min(2),
  question: z.object({
    text: z.string(),
    skill: z.enum(["analise", "sintese", "aplicacao", "reflexao"]).optional(),
    intention: z.string().optional(),
    expected_depth: z.string().optional(),
  }),
  qaScores: z.array(
    z.object({
      score: z.number().min(0).max(1),
      verdict: z.enum(["APPROVED", "REJECTED"]),
    }),
  ),
  existingProfile: z
    .object({
      preferred_question_types: z.array(z.string()),
      engagement_style: z.string(),
      detail_orientation: z.string(),
      reasoning_style: z.string(),
      avg_depth_achieved: z.number(),
      comprehension_trend: z.string(),
      avg_qa_score: z.number(),
      strengths: z.array(z.string()),
      growth_areas: z.array(z.string()),
      adaptation_hints: z.array(z.string()),
      summary: z.string(),
      sessions_analyzed: z.number(),
      last_updated: z.string(),
      confidence: z.number(),
      version: z.number(),
    })
    .nullable(),
  sessionCount: z.number().int().min(0),
})

export type ProfilerInput = z.infer<typeof profilerInputSchema>

// --- Output Schema ---

export const profilerOutputSchema = z.object({
  preferred_question_types: z
    .array(
      z.enum([
        "clarificacao",
        "suposicoes",
        "evidencias",
        "perspectivas",
        "consequencias",
        "aplicacao",
        "metacognicao",
      ]),
    )
    .max(4),
  engagement_style: z.enum(["reflective", "impulsive", "balanced"]),
  detail_orientation: z.enum(["verbose", "concise", "balanced"]),
  reasoning_style: z.enum(["analytical", "creative", "systematic", "intuitive"]),
  avg_depth_achieved: z.number().min(1).max(6),
  comprehension_trend: z.enum(["improving", "stable", "declining"]),
  avg_qa_score: z.number().min(0).max(1),
  strengths: z.array(z.string().max(100)).max(5),
  growth_areas: z.array(z.string().max(100)).max(3),
  adaptation_hints: z.array(z.string().max(200)).max(5),
  summary: z.string().max(500),
  confidence: z.number().min(0).max(1),
})

export type ProfilerOutput = z.infer<typeof profilerOutputSchema>
