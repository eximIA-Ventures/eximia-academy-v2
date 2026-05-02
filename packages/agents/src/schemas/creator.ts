import { z } from "zod"

export const creatorInputSchema = z.object({
  chapter_content: z
    .string()
    .min(100, "Conteúdo deve ter no minimo 100 caracteres")
    .max(50000, "Conteúdo deve ter no maximo 50000 caracteres"),
  chapter_title: z.string().optional(),
  learning_objective: z.string().optional(),
  max_questions: z.number().int().min(1).max(3).default(3),
  difficulty: z.enum(["iniciante", "intermediario", "avancado"]).default("intermediario"),
})

const questionSchema = z.object({
  text: z.string(),
  skill: z.enum(["analise", "sintese", "aplicacao", "reflexao"]),
  intention: z.string(),
  expected_depth: z.string(),
  common_shallow_answer: z.string(),
  followup_prompts: z.array(z.string()),
  citations: z.array(z.string()),
  has_practical_scenario: z.boolean().nullable(),
})

export const creatorOutputSchema = z.object({
  analysis: z
    .object({
      main_concepts: z.array(z.string()),
      key_relationships: z.array(z.string()),
      potential_angles: z.array(z.string()),
      content_complexity: z.enum(["baixa", "media", "alta"]).nullable(),
    })
    .nullable(),
  questions: z.array(questionSchema).min(1).max(3),
  quality_checks: z
    .object({
      all_questions_non_generic: z.boolean(),
      skills_diversity: z.boolean(),
      has_practical_scenario: z.boolean(),
      all_metadata_complete: z.boolean(),
      unique_angles: z.boolean(),
    })
    .nullable(),
  metadata: z.object({
    chapter_title: z.string(),
    questions_generated: z.number().int(),
    skills_covered: z.array(z.string()),
    has_practical_scenario: z.boolean(),
  }),
  warnings: z.array(z.string()).nullable(),
})

export type CreatorInput = z.infer<typeof creatorInputSchema>
export type CreatorOutput = z.infer<typeof creatorOutputSchema>
export type GeneratedQuestion = z.infer<typeof questionSchema>
