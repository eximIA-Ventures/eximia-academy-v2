import { z } from "zod"

export const questionDbSchema = z.object({
  chapter_id: z.string().uuid(),
  text: z.string().min(1),
  skill: z.enum(["analise", "sintese", "aplicacao", "reflexao"]),
  intention: z.string().min(1),
  expected_depth: z.string().optional(),
  common_shallow_answer: z.string().optional(),
  followup_prompts: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type QuestionDbInput = z.infer<typeof questionDbSchema>
