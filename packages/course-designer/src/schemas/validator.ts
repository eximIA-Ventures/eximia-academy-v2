import { z } from "zod"
import { qualityVerdictSchema } from "./shared"

// --- Framework Score Dimension (AC2) ---

export const frameworkDimensionSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number(),
  details: z.string(),
  issues: z.array(z.string()),
})

// --- Framework Completeness Dimension (extends base) ---

export const frameworkCompletenessDimensionSchema = frameworkDimensionSchema.extend({
  framework_used: z.string(),
  stages_covered: z.array(z.string()),
  stages_missing: z.array(z.string()),
})

// --- Framework Score (AC2 — 70% of final) ---

export const frameworkScoreSchema = z.object({
  total: z.number().min(0).max(100),
  alignment: frameworkDimensionSchema, // weight: 0.30
  bloom_progression: frameworkDimensionSchema, // weight: 0.20
  framework_completeness: frameworkCompletenessDimensionSchema, // weight: 0.25
  duration: frameworkDimensionSchema, // weight: 0.15
  cognitive_load: frameworkDimensionSchema, // weight: 0.10
})

// --- Neuroscience Rule Result (AC3) ---

export const neuroscienceRuleResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  passed: z.boolean(),
  weight: z.number(),
  details: z.string(),
})

// --- Neuroscience Score (AC2 — 30% of final) ---

export const neuroscienceScoreSchema = z.object({
  total: z.number().min(0).max(100),
  rules: z.array(neuroscienceRuleResultSchema),
})

// --- Quality Scorecard (AC2) ---

export const qualityScorecardSchema = z.object({
  framework_score: frameworkScoreSchema,
  neuroscience_score: neuroscienceScoreSchema,
  final_score: z.number().min(0).max(100),
  verdict: qualityVerdictSchema,
  critical_issues: z.array(z.string()),
  recommendations: z.array(z.string()),
})

export type ValidatorOutput = z.infer<typeof qualityScorecardSchema>
