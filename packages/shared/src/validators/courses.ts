import { z } from "zod"

export const createCourseSchema = z.object({
  title: z
    .string()
    .min(10, "Título deve ter no mínimo 10 caracteres")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  description: z.string().optional(),
  type: z.enum(["regular", "onboarding"]).default("regular"),
  area_id: z.string().uuid("ID da área inválido").optional(),
  cover_image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")),
  deadline_days: z.coerce.number().int().min(1).max(365).optional().nullable(),
})

export const updateCourseSchema = createCourseSchema.partial().extend({
  id: z.string().uuid("ID do curso inválido"),
})

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>

export type CourseType = "regular" | "onboarding"
