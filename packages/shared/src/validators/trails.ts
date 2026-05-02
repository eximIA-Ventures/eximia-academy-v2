import { z } from "zod"

export const createTrailSchema = z.object({
  title: z.string().min(3, "Titulo deve ter pelo menos 3 caracteres").max(200),
  description: z.string().max(1000).nullable().optional(),
  target_job_role_id: z.string().uuid().nullable().optional(),
  estimated_hours: z.number().int().min(1).max(10000).nullable().optional(),
  is_mandatory: z.boolean().default(false),
  courses: z
    .array(
      z.object({
        course_id: z.string().uuid(),
        order: z.number().int().min(0),
        is_required: z.boolean().default(true),
        estimated_hours: z.number().int().min(1).nullable().optional(),
      }),
    )
    .min(1, "Selecione pelo menos 1 curso"),
})

export type CreateTrailInput = z.infer<typeof createTrailSchema>

export const updateTrailSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  target_job_role_id: z.string().uuid().nullable().optional(),
  estimated_hours: z.number().int().min(1).max(10000).nullable().optional(),
  is_mandatory: z.boolean().optional(),
})

export type UpdateTrailInput = z.infer<typeof updateTrailSchema>

export const reorderTrailCoursesSchema = z.object({
  courses: z.array(
    z.object({
      course_id: z.string().uuid(),
      order: z.number().int().min(0),
    }),
  ),
})

export type ReorderTrailCoursesInput = z.infer<typeof reorderTrailCoursesSchema>
