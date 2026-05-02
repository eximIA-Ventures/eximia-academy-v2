import { z } from "zod"

// --- Input Schema ---

export const testerInputSchema = z.object({
  edited_response: z.string().min(10),
  context: z
    .object({
      chapter_title: z.string().optional(),
      chapter_summary: z.string().optional(),
      student_message: z.string().optional(),
      conversation_turn: z.number().int().min(1).optional(),
      original_response: z.string().optional(),
    })
    .optional(),
  validation_config: z
    .object({
      strict_mode: z.boolean().default(false),
      include_observations: z.boolean().default(true),
    })
    .optional(),
})

export type TesterInput = z.infer<typeof testerInputSchema>

// --- Output Schema ---

const criterionResultSchema = z.object({
  passed: z.boolean(),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]),
  notes: z.string(),
})

export const testerOutputSchema = z.object({
  verdict: z.enum(["APPROVED", "REJECTED"]),
  score: z.number().min(0).max(1),
  criteria_results: z.object({
    C1_no_direct_answer: criterionResultSchema,
    C2_open_question: criterionResultSchema,
    C3_constructive_feedback: criterionResultSchema,
    C4_no_labels: criterionResultSchema,
    C5_natural_flow: criterionResultSchema,
    C6_topic_connection: criterionResultSchema,
  }),
  summary: z.object({
    passed_count: z.number().int().min(0).max(6),
    failed_count: z.number().int().min(0).max(6),
    critical_failures: z.array(z.string()),
    major_failures: z.array(z.string()),
    minor_issues: z.array(z.string()),
  }),
  recommendation: z.string(),
  observations: z.array(z.string()),
})

export type TesterOutput = z.infer<typeof testerOutputSchema>
