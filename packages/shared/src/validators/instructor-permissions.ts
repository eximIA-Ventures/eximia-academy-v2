import { z } from "zod"

export const updateInstructorPermissionsSchema = z.object({
  can_create_courses: z.boolean().default(true),
  can_create_quizzes: z.boolean().default(true),
  can_manage_trails: z.boolean().default(false),
  can_view_analytics: z.boolean().default(true),
  can_manage_enrollments: z.boolean().default(true),
  assigned_area_ids: z.array(z.string().uuid("ID de area inválido")).default([]),
})

export type UpdateInstructorPermissionsInput = z.infer<typeof updateInstructorPermissionsSchema>
