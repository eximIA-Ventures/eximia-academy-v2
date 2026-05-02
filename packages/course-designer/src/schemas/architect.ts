import { interactionTypeSchema } from "@eximia/shared"
import { z } from "zod"
import { bloomLevelSchema, spiralLevelSchema } from "./shared"

// --- ABCD Objective (AC3) ---

export const abcdObjectiveSchema = z.object({
  audience: z.string(),
  behavior: z.string(),
  condition: z.string(),
  degree: z.string(),
})

export const objectiveSchema = z.object({
  text: z.string(),
  bloom_level: bloomLevelSchema,
  abcd: abcdObjectiveSchema,
})

// --- Assessment (AC4) ---

export const kirkpatrickLevelSchema = z.enum(["L1", "L2", "L3", "L4"])
export type KirkpatrickLevel = z.infer<typeof kirkpatrickLevelSchema>

export const assessmentTypeSchema = z.enum(["formative", "summative", "diagnostic"])

export const assessmentMethodSchema = z.enum([
  "quiz",
  "rubric",
  "peer_review",
  "self_assessment",
  "portfolio",
  "project",
  "case_study",
  "simulation",
  "observation",
  "reflection",
])

export const assessmentSchema = z.object({
  type: assessmentTypeSchema,
  method: assessmentMethodSchema,
  description: z.string(),
  alignment: z.string(),
  kirkpatrick_level: kirkpatrickLevelSchema,
})

// --- Framework Stage per Module (AC6) ---

export const moduleFrameworkStageSchema = z.object({
  key: z.string(),
  name: z.string(),
  percentage: z.number().min(0).max(100),
  activities: z.array(z.string()),
  deliverable: z.string().optional(),
})

// --- Problema-Motor (AC7) ---

export const problemaMotorSchema = z.object({
  description: z.string(),
  pressure: z.number().min(1).max(5),
  ambiguity: z.number().min(1).max(5),
  stakes: z.number().min(1).max(5),
  tension_score: z.number().min(1).max(125),
})

// --- Module (AC2) ---

export const moduleSchema = z.object({
  order: z.number().min(1),
  title: z.string(),
  description: z.string(),
  spiral_level: spiralLevelSchema,
  objectives: z.array(objectiveSchema).min(1),
  assessments: z.array(assessmentSchema).min(1),
  framework_stages: z.array(moduleFrameworkStageSchema).min(1),
  problema_motor: problemaMotorSchema.nullable(),
  rubrics: z.string().nullable(),
  interaction_type: interactionTypeSchema,
  prerequisites: z.array(z.string()).optional(),
})

// --- Assessment Strategy (AC2) ---

export const assessmentStrategySchema = z.object({
  formative_count: z.number().min(0),
  summative_count: z.number().min(0),
  diagnostic_count: z.number().min(0),
  overall_approach: z.string(),
  kirkpatrick_coverage: z.object({
    L1: z.boolean(),
    L2: z.boolean(),
    L3: z.boolean(),
    L4: z.boolean(),
  }),
})

// --- Course Structure (AC2) ---

export const courseStructureSchema = z.object({
  total_modules: z.number().min(1).max(30),
  primary_framework: z.string(),
  complementary_frameworks: z.array(z.string()),
  bloom_progression: z.array(bloomLevelSchema),
  spiral_levels: z.array(spiralLevelSchema),
})

// --- Architect Output (AC2) ---

export const architectOutputSchema = z.object({
  course_structure: courseStructureSchema,
  modules: z.array(moduleSchema).min(1).max(30),
  assessment_strategy: assessmentStrategySchema,
  facilitation_notes: z.string().optional(),
})

export type ArchitectOutput = z.infer<typeof architectOutputSchema>
