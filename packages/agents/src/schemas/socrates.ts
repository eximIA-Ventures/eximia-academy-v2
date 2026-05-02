import { z } from "zod"

// --- Input Schema ---

const questionContextSchema = z.object({
  text: z.string(),
  skill: z.enum(["analise", "sintese", "aplicacao", "reflexao"]).optional(),
  intention: z.string().optional(),
  expected_depth: z.string().optional(),
})

const conversationMessageSchema = z.object({
  role: z.enum(["student", "assistant"]),
  content: z.string(),
  timestamp: z.string().optional(),
})

const sessionContextSchema = z.object({
  session_id: z.string(),
  chapter_id: z.string(),
  chapter_title: z.string().optional(),
  chapter_content: z.string().optional(),
  initial_question: questionContextSchema,
  interactions_remaining: z.number().int().min(0).max(3),
  learning_objective: z.string().optional(),
})

export const socratesInputSchema = z.object({
  session_context: sessionContextSchema,
  conversation_history: z.array(conversationMessageSchema).default([]),
  student_message: z.object({
    content: z.string().min(1),
    timestamp: z.string().optional(),
  }),
  tester_feedback: z.string().optional(), // Added for retry flow (S3.2-L2)
})

export type SocratesInput = z.infer<typeof socratesInputSchema>

// --- Output Schema ---

export const socratesOutputSchema = z.object({
  response: z.object({
    content: z.string().min(50).max(1500),
    feedback_summary: z.string().nullable(),
    question_asked: z.string().nullable(),
    question_type: z
      .enum([
        "clarificacao",
        "suposicoes",
        "evidencias",
        "perspectivas",
        "consequencias",
        "aplicacao",
        "metacognicao",
      ])
      .nullable(),
    has_question: z.boolean(),
    is_final_interaction: z.boolean(),
    depth_level: z.number().int().min(1).max(6).nullable(),
  }),
  quality_checks: z
    .object({
      no_direct_answer: z.boolean(),
      no_artificial_labels: z.boolean(),
      ends_with_question: z.boolean(),
      connected_to_chapter: z.boolean(),
      references_student_input: z.boolean(),
      within_length_limit: z.boolean(),
    })
    .nullable(),
  analytics: z
    .object({
      response_length: z.number().int().nullable(),
      processing_time_ms: z.number().int().nullable(),
      model_used: z.string().nullable(),
    })
    .nullable(),
  session_status: z
    .object({
      interactions_remaining: z.number().int().min(0).nullable(),
      should_finalize: z.boolean().nullable(),
      finalization_reason: z
        .enum(["max_interactions_reached", "student_concluded", "error"])
        .nullable(),
    })
    .nullable(),
})

export type SocratesOutput = z.infer<typeof socratesOutputSchema>
