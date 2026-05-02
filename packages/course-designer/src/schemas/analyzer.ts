import { z } from "zod"
import { bloomLevelSchema, frameworkIdSchema, spiralLevelSchema } from "./shared"

// --- Enums specific to Analyzer ---

export const zpdLevelSchema = z.enum(["iniciante", "intermediario", "avancado", "especialista"])
export type ZpdLevel = z.infer<typeof zpdLevelSchema>

export const motivationTypeSchema = z.enum([
  "intrinsic",
  "extrinsic",
  "mixed",
  "achievement",
  "social",
  "mastery",
])
export type MotivationType = z.infer<typeof motivationTypeSchema>

export const kolbStyleSchema = z.enum(["diverger", "assimilator", "converger", "accommodator"])
export type KolbStyle = z.infer<typeof kolbStyleSchema>

// --- Selected Framework (AC2) ---

export const selectedFrameworkSchema = z.object({
  primary: frameworkIdSchema,
  complementary: z.array(frameworkIdSchema),
  rationale: z.string(),
  was_user_selected: z.boolean(),
  recommendation_confidence: z.number().min(0).max(1),
})

// --- Audience Profile (AC2) ---

export const adultLearningProfileSchema = z.object({
  self_directed: z.boolean(),
  experience_based: z.boolean(),
  problem_centered: z.boolean(),
  relevance_oriented: z.boolean(),
})

export const audienceProfileSchema = z.object({
  zpd_level: zpdLevelSchema,
  motivation_type: motivationTypeSchema,
  prior_knowledge_summary: z.string(),
  learning_preferences: z.array(z.string()),
  attention_span_minutes: z.number().min(5).max(120),
  adult_learning_profile: adultLearningProfileSchema,
  kolb_style: kolbStyleSchema.optional(),
})

// --- Gap Analysis (AC2) ---

export const gapAnalysisSchema = z.object({
  current_state: z.string(),
  desired_state: z.string(),
  critical_gaps: z.array(z.string()),
  estimated_modules: z.number().min(1).max(30),
})

// --- Analyzer Output (AC2) ---

export const analyzerOutputSchema = z.object({
  selected_framework: selectedFrameworkSchema,
  audience_profile: audienceProfileSchema,
  gap_analysis: gapAnalysisSchema,
  recommendations: z.array(z.string()),
})

export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>
