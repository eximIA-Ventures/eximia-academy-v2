import { z } from "zod"

export const organizerInputSchema = z.object({
  raw_text: z
    .string()
    .min(200, "Conteúdo deve ter no minimo 200 caracteres")
    .max(500000, "Conteúdo deve ter no maximo 500000 caracteres"),
  source_filename: z.string().optional(),
  source_type: z.enum(["pdf", "docx", "pptx", "txt", "audio", "video_url", "paste"]),
  language: z.string().default("pt-br"),
  max_chapters: z.number().int().min(1).max(50).default(15),
  instructions: z.string().optional(),
})

const organizedChapterSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(200),
  learning_objective: z.string().min(10),
  order: z.number().int().min(0),
  key_concepts: z.array(z.string()).min(1),
  estimated_reading_time_min: z.number().min(1),
  /** Optional module grouping — used when content has clear thematic sections. */
  module_title: z.string().optional(),
})

export const organizerOutputSchema = z.object({
  suggested_title: z.string().min(5),
  suggested_description: z.string().min(20),
  chapters: z.array(organizedChapterSchema).min(1).max(50),
  metadata: z.object({
    total_chapters: z.number().int(),
    content_complexity: z.enum(["baixa", "media", "alta"]),
    main_topics: z.array(z.string()),
    suggested_area: z.string().nullable(),
  }),
  warnings: z.array(z.string()).nullable(),
})

export type OrganizerInput = z.infer<typeof organizerInputSchema>
export type OrganizerOutput = z.infer<typeof organizerOutputSchema>
export type OrganizedChapter = z.infer<typeof organizedChapterSchema>
