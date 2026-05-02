import { z } from "zod"

export const createQuizSessionSchema = z.object({
  title: z.string().min(3, "Titulo deve ter pelo menos 3 caracteres").max(200),
  quiz_type: z.enum(["practice", "exam", "diagnostic"]),
  chapter_id: z.string().uuid().nullable().optional(),
  question_ids: z.array(z.string().uuid()).min(1, "Selecione pelo menos 1 questao"),
  time_limit_minutes: z.number().int().min(1).max(300).nullable().optional(),
  max_attempts: z.number().int().min(1).max(100).default(3),
  passing_score: z.number().min(0).max(100).default(70),
  shuffle_questions: z.boolean().default(false),
  show_answers_after: z.enum(["completion", "never", "always"]).default("completion"),
})

export type CreateQuizSessionInput = z.infer<typeof createQuizSessionSchema>

export const updateQuizSessionSchema = createQuizSessionSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export type UpdateQuizSessionInput = z.infer<typeof updateQuizSessionSchema>
