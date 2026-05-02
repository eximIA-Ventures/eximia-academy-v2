import { z } from "zod"

export const featureKeySchema = z.enum([
  "courses",
  "course_designer",
  "quizzes",
  "trails",
  "assessments",
  "webhooks",
  "api_access",
])

export type FeatureKeyInput = z.infer<typeof featureKeySchema>

export const updatePlanFeatureSchema = z.object({
  plan: z.enum(["essencial", "standard", "premium"]),
  feature_key: featureKeySchema,
  is_enabled: z.boolean(),
  quota: z.number().int().min(1).nullable().optional(),
})

export type UpdatePlanFeatureInput = z.infer<typeof updatePlanFeatureSchema>
