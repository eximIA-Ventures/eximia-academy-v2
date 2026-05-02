import { z } from "zod"

// --- Input Schema ---

export const analystInputSchema = z.object({
  student_message: z.string().min(1),
  context: z
    .object({
      chapter_id: z.string().optional(),
      chapter_title: z.string().optional(),
      chapter_content: z.string().optional(),
      conversation_history: z
        .array(
          z.object({
            role: z.enum(["student", "tutor"]),
            content: z.string(),
            timestamp: z.string().optional(),
          }),
        )
        .optional(),
      turn_number: z.number().int().min(1).max(3).optional(),
    })
    .optional(),
  interaction_metadata: z
    .object({
      session_id: z.string().optional(),
      student_id: z.string().optional(),
      timestamp: z.string().optional(),
      previous_message_timestamp: z.string().optional(),
      response_time_seconds: z.number().optional(),
    })
    .optional(),
})

export type AnalystInput = z.infer<typeof analystInputSchema>

// --- Output Schema ---

const indicatorSchema = z.object({
  type: z.string(),
  description: z.string(),
  weight: z.number().min(-1).max(1),
})

export const analystOutputSchema = z.object({
  analysis_id: z.string(),
  timestamp: z.string(),
  ai_detection: z.object({
    probability: z.number().min(0).max(1),
    confidence: z.enum(["high", "medium", "low"]),
    verdict: z.enum(["likely_human", "uncertain", "likely_ai"]),
    indicators: z.array(indicatorSchema),
    flag: z.enum(["alta_probabilidade_texto_IA"]).nullable(),
  }),
  metrics: z.object({
    text: z
      .object({
        message_length_chars: z.number().int().min(0),
        message_length_words: z.number().int().min(0),
        sentence_count: z.number().int().min(0),
        avg_words_per_sentence: z.number().min(0),
        has_question: z.boolean(),
      })
      .nullable(),
    time: z
      .object({
        timestamp: z.string().nullable(),
        response_time_seconds: z.number().int().min(0).nullable(),
      })
      .nullable(),
    context: z
      .object({
        turn_number: z.number().int().min(1).max(3).nullable(),
        chapter_id: z.string().nullable(),
        session_id: z.string().nullable(),
      })
      .nullable(),
    quality: z
      .object({
        topic_relevance: z.number().min(0).max(1).nullable(),
        depth_of_thought: z.enum(["superficial", "moderate", "deep"]).nullable(),
        engagement_level: z.enum(["low", "medium", "high"]).nullable(),
      })
      .nullable(),
  }),
  flags: z.array(z.string()),
  observations: z.array(z.string()),
  recommendation: z.string(),
})

export type AnalystOutput = z.infer<typeof analystOutputSchema>
