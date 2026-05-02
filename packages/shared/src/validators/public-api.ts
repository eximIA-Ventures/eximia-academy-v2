import { z } from "zod"

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
})

export const courseFiltersSchema = paginationSchema.extend({
  status: z.enum(["draft", "active", "archived"]).optional(),
  type: z.enum(["regular", "onboarding"]).optional(),
  area_id: z.string().uuid().optional(),
})

export const blueprintFiltersSchema = paginationSchema.extend({
  status: z.enum(["draft", "generating", "generated", "approved", "rejected"]).optional(),
  primary_framework: z.string().optional(),
})

export const enrollmentFiltersSchema = paginationSchema.extend({
  status: z.enum(["active", "completed", "dropped"]).optional(),
  course_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
})

export type PaginationInput = z.infer<typeof paginationSchema>
export type CourseFiltersInput = z.infer<typeof courseFiltersSchema>
export type BlueprintFiltersInput = z.infer<typeof blueprintFiltersSchema>
export type EnrollmentFiltersInput = z.infer<typeof enrollmentFiltersSchema>
