import { z } from "zod"

export const createChapterSchema = z
  .object({
    title: z.string().min(1, "Título é obrigatório").max(200, "Título muito longo"),
    content: z.string().optional(),
    content_blocks: z.array(z.record(z.unknown())).optional(),
    learning_objective: z.string().optional(),
    video_url: z
      .string()
      .url("URL do vídeo inválida")
      .refine((url) => url.startsWith("https://"), "URL do vídeo deve ser HTTPS")
      .optional()
      .or(z.literal("")),
    audio_url: z.string().url("URL do áudio inválida").optional().or(z.literal("")),
    key_concepts: z.array(z.string()).optional(),
    estimated_reading_time_min: z.number().int().positive().optional(),
  })
  .refine((data) => data.content_blocks?.length || (data.content && data.content.length >= 100), {
    message: "Conteúdo deve ter no mínimo 100 caracteres",
    path: ["content"],
  })

export const updateChapterSchema = z.object({
  id: z.string().uuid("ID do capítulo inválido"),
  title: z.string().min(1, "Título é obrigatório").max(200, "Título muito longo").optional(),
  content: z.string().optional(),
  content_blocks: z.array(z.record(z.unknown())).optional(),
  learning_objective: z.string().optional(),
  video_url: z
    .string()
    .url("URL do vídeo inválida")
    .refine((url) => url.startsWith("https://"), "URL do vídeo deve ser HTTPS")
    .optional()
    .or(z.literal("")),
  audio_url: z.string().url("URL do áudio inválida").optional().or(z.literal("")),
})

export const reorderChaptersSchema = z.array(
  z.object({
    id: z.string().uuid(),
    order: z.number().int().min(0),
  }),
)

export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>
export type ReorderChaptersInput = z.infer<typeof reorderChaptersSchema>
