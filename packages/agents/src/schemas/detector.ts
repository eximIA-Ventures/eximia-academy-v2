import { z } from "zod"

// --- Camada A: Padrones Cognitivos ---

const dominantPatternSchema = z.object({
  pattern: z.string(),
  evidence: z.string(),
  frequency: z.enum(["low", "medium", "high"]),
})

const cognitivePatternsSchema = z.object({
  dominant_patterns: z.array(dominantPatternSchema),
  implicit_values: z.array(z.string()),
  cognitive_loops: z.array(z.string()),
  readiness_level: z.enum(["defensive", "exploring", "integrating"]),
  suggested_question_type: z.string(),
})

// --- Camada B: Deteccao de IA ---

const aiIndicatorSchema = z.object({
  type: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
})

const aiDetectionSchema = z.object({
  probability: z.number().min(0).max(1),
  confidence: z.enum(["high", "medium", "low"]),
  verdict: z.enum(["likely_human", "uncertain", "likely_ai"]),
  indicators: z.array(aiIndicatorSchema),
  flag: z.string().nullable(),
})

// --- Camada C: Linguistica Profunda ---

const linguisticAnalysisSchema = z.object({
  emotional_density: z.number().min(0).max(1),
  abstraction_level: z.number().min(1).max(10),
  certainty_vs_exploration: z.number().min(-1).max(1),
  defense_active: z.boolean(),
})

// --- Jornada da Sessão ---

const breakthroughCandidateSchema = z.object({
  trigger: z.string(),
  marker: z.string(),
})

const sessionJourneySchema = z.object({
  emotional_arc: z.array(z.string()),
  depth_progression: z.array(z.number()),
  breakthrough_candidates: z.array(breakthroughCandidateSchema),
})

// --- Output Schema ---

export const detectorOutputSchema = z.object({
  cognitive_patterns: cognitivePatternsSchema,
  ai_detection: aiDetectionSchema,
  linguistic_analysis: linguisticAnalysisSchema,
  session_journey: sessionJourneySchema,
})

export type DetectorOutput = z.infer<typeof detectorOutputSchema>
