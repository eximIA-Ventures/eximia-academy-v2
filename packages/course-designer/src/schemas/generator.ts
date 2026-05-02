import { interactionTypeSchema } from "@eximia/shared"
import { z } from "zod"
import {
  bloomLevelSchema,
  frameworkIdSchema,
  qualityVerdictSchema,
  spiralLevelSchema,
} from "./shared"
import { qualityScorecardSchema } from "./validator"

// --- Blueprint Metadata (AC6) ---

export const blueprintMetadataSchema = z.object({
  title: z.string(),
  version: z.string(),
  generated_at: z.string(),
  primary_framework: frameworkIdSchema,
  complementary_frameworks: z.array(frameworkIdSchema),
  total_duration_hours: z.number(),
  total_modules: z.number(),
  quality_score: z.number().min(0).max(100),
  neuroscience_score: z.number().min(0).max(100),
  language: z.enum(["pt-br", "en"]),
  interaction_strategy: z.enum(["bloom_mapped", "dominant", "custom"]),
})

// --- Blueprint Audience (AC6) ---

export const blueprintAudienceSchema = z.object({
  role: z.string(),
  experience_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
  zpd_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
  motivation_type: z.string(),
  kolb_style: z.string().optional(),
  adult_learning_profile: z.object({
    self_directed: z.boolean(),
    experience_based: z.boolean(),
    problem_centered: z.boolean(),
    relevance_oriented: z.boolean(),
  }),
})

// --- Blueprint Course Architecture (AC6) ---

export const blueprintCourseArchitectureSchema = z.object({
  bloom_progression: z.array(bloomLevelSchema),
  spiral_curriculum: z.array(spiralLevelSchema),
})

// --- Blueprint Objective (AC6) ---

export const blueprintObjectiveSchema = z.object({
  text: z.string(),
  bloom_level: bloomLevelSchema,
  abcd: z.object({
    audience: z.string(),
    behavior: z.string(),
    condition: z.string(),
    degree: z.string(),
  }),
})

// --- Blueprint Assessment (AC6) ---

export const blueprintAssessmentSchema = z.object({
  type: z.enum(["formative", "summative", "diagnostic"]),
  method: z.string(),
  description: z.string(),
  alignment: z.string(),
  kirkpatrick_level: z.enum(["L1", "L2", "L3", "L4"]),
})

// --- Blueprint Framework Stage (AC6) ---

export const blueprintFrameworkStageSchema = z.object({
  key: z.string(),
  name: z.string(),
  percentage: z.number(),
  activities: z.array(z.string()),
  deliverable: z.string().optional(),
})

// --- Blueprint Chunk (AC6) ---

export const blueprintChunkSchema = z.object({
  title: z.string(),
  duration_min: z.number().min(5).max(30),
  type: z.enum(["content", "activity", "assessment", "break", "reflection"]),
})

// --- Blueprint Problema-Motor (AC6) ---

export const blueprintProblemaMotorSchema = z.object({
  description: z.string(),
  pressure: z.number().min(1).max(5),
  ambiguity: z.number().min(1).max(5),
  stakes: z.number().min(1).max(5),
  tension_score: z.number().min(1).max(125),
})

// --- Blueprint Module (AC6) ---

export const blueprintModuleSchema = z.object({
  order: z.number().min(1),
  title: z.string(),
  description: z.string(),
  duration_minutes: z.number(),
  spiral_level: spiralLevelSchema,
  objectives: z.array(blueprintObjectiveSchema).min(1),
  framework_stages: z.array(blueprintFrameworkStageSchema).min(1),
  problema_motor: blueprintProblemaMotorSchema.nullable(),
  assessments: z.array(blueprintAssessmentSchema).min(1),
  rubrics: z.string().nullable(),
  chunks: z.array(blueprintChunkSchema).min(1),
  interaction_type: interactionTypeSchema,
})

// --- Evaluation Plan — Kirkpatrick (AC6) ---

export const evaluationPlanSchema = z.object({
  L1: z.object({ description: z.string(), methods: z.array(z.string()) }),
  L2: z.object({ description: z.string(), methods: z.array(z.string()) }),
  L3: z.object({ description: z.string(), methods: z.array(z.string()) }),
  L4: z.object({ description: z.string(), methods: z.array(z.string()) }),
})

// --- Implementation Checklist (AC6) ---

export const checklistPrioritySchema = z.enum(["must", "should", "could"])

export const implementationChecklistItemSchema = z.object({
  item: z.string(),
  priority: checklistPrioritySchema,
})

// --- Blueprint (AC6 — Final Output) ---

export const blueprintSchema = z.object({
  metadata: blueprintMetadataSchema,
  audience: blueprintAudienceSchema,
  course_architecture: blueprintCourseArchitectureSchema,
  modules: z.array(blueprintModuleSchema).min(1).max(30),
  evaluation_plan: evaluationPlanSchema,
  quality_scorecard: qualityScorecardSchema,
  implementation_checklist: z.array(implementationChecklistItemSchema),
  requires_instructor_review: z.boolean(),
})

export type Blueprint = z.infer<typeof blueprintSchema>
