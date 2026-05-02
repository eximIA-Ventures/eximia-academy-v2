import { interactionTypeSchema } from "@eximia/shared"
import { z } from "zod"

// --- Enums (AC2, AC4, AC5, AC6) ---

export const bloomLevelSchema = z.enum([
  "remembering",
  "understanding",
  "applying",
  "analyzing",
  "evaluating",
  "creating",
])
export type BloomLevel = z.infer<typeof bloomLevelSchema>

export const spiralLevelSchema = z.enum([
  "fundamentos",
  "variacao",
  "conflito_humano",
  "mundo_real",
  "sintese",
])
export type SpiralLevel = z.infer<typeof spiralLevelSchema>

export const qualityVerdictSchema = z.enum(["excellent", "good", "needs_revision", "poor"])
export type QualityVerdict = z.infer<typeof qualityVerdictSchema>

export const frameworkIdSchema = z.enum(["elc_plus", "kolb_4", "pbl_hmelo"])
export type FrameworkId = z.infer<typeof frameworkIdSchema>

// --- FrameworkConfig sub-schemas (AC1) ---

export const frameworkStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  time_percentage: z.number(),
  default_interaction: interactionTypeSchema,
  purpose: z.string(),
})

export const sequencingLevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.enum(["early", "mid", "late"]),
  modules_range: z.string(),
})

export const sequencingSchema = z.object({
  model: z.enum(["spiral", "linear", "problem_complexity"]),
  levels: z.array(sequencingLevelSchema).optional(),
  progression_rule: z.string(),
})

export const bloomInteractionMapSchema = z.record(
  bloomLevelSchema,
  z.object({
    interaction: interactionTypeSchema,
    turns: z.number(),
    depth_range: z.tuple([z.number(), z.number()]),
  }),
)

export const positionalAdjustmentSchema = z.object({
  position: z.string(),
  condition: z.string(),
  action: z.string(),
  rationale: z.string(),
})

export const qualityCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number(),
  validation_rule: z.string(),
  failure_message: z.string(),
})

export const assessmentDimensionSchema = z.object({
  name: z.string(),
  weight: z.number(),
  levels: z.array(
    z.object({
      score: z.number(),
      label: z.string(),
      description: z.string(),
    }),
  ),
})

export const specialRequirementsSchema = z.object({
  group_size: z.object({ min: z.number(), max: z.number() }).optional(),
  sdl_interval: z.string().optional(),
  facilitator_role: z.string().optional(),
  problem_design_framework: z.string().optional(),
  whiteboard_tool: z.boolean().optional(),
})

// --- FrameworkConfig (AC1) ---

export const frameworkConfigSchema = z.object({
  id: frameworkIdSchema,
  name: z.string(),
  type: z.literal("learning_cycle"),
  stages: z.array(frameworkStageSchema),
  sequencing: sequencingSchema,
  bloom_interaction_map: bloomInteractionMapSchema,
  positional_adjustments: z.array(positionalAdjustmentSchema),
  quality_criteria: z.array(qualityCriterionSchema),
  assessment_dimensions: z.array(assessmentDimensionSchema),
  special_requirements: specialRequirementsSchema.optional(),
})
export type FrameworkConfig = z.infer<typeof frameworkConfigSchema>

// Re-export InteractionType from @eximia/shared for convenience
export { interactionTypeSchema }
export type { InteractionType } from "@eximia/shared"
