import { z } from "zod"

// --- Chunk types (AC5) ---

export const chunkTypeSchema = z.enum(["content", "activity", "assessment", "break", "reflection"])
export type ChunkType = z.infer<typeof chunkTypeSchema>

// --- Cognitive Load levels (AC4 — CLT Sweller) ---

export const loadLevelSchema = z.enum(["low", "medium", "high", "overloaded"])
export type LoadLevel = z.infer<typeof loadLevelSchema>

// --- Cognitive Load Balance (AC4) ---

export const loadBalanceSchema = z.enum(["optimal", "adjustable", "overloaded"])
export type LoadBalance = z.infer<typeof loadBalanceSchema>

// --- Chunk (AC5) ---

export const chunkSchema = z.object({
  title: z.string(),
  duration_min: z.number().min(5).max(30),
  type: chunkTypeSchema,
})

// --- Time Allocation per Module (AC3) ---

export const moduleTimeSchema = z.object({
  module_order: z.number().min(1),
  total_minutes: z.number().min(1),
  per_stage: z.record(z.string(), z.number()),
  chunks: z.array(chunkSchema).min(1),
})

// --- Time Allocation (AC2) ---

export const timeAllocationSchema = z.object({
  total_minutes: z.number().min(1),
  modules: z.array(moduleTimeSchema).min(1),
  attention_span_respected: z.boolean(),
})

// --- Cognitive Load per Module (AC4) ---

export const moduleCognitiveLoadSchema = z.object({
  module_order: z.number().min(1),
  intrinsic_load: loadLevelSchema,
  extraneous_load: loadLevelSchema,
  germane_load: loadLevelSchema,
  new_concepts_count: z.number().min(0),
  concurrent_concepts: z.number().min(0),
  recommendation: z.string(),
})

// --- Cognitive Load (AC2) ---

export const cognitiveLoadSchema = z.object({
  modules: z.array(moduleCognitiveLoadSchema).min(1),
  overall_balance: loadBalanceSchema,
  warnings: z.array(z.string()),
})

// --- Pacing Strategy (AC2) ---

export const pacingStrategySchema = z.object({
  recommended_schedule: z.string(),
  spaced_repetition_points: z.array(z.string()),
  break_pattern: z.string(),
})

// --- Calculator Output (AC2) ---

export const calculatorOutputSchema = z.object({
  time_allocation: timeAllocationSchema,
  cognitive_load: cognitiveLoadSchema,
  pacing_strategy: pacingStrategySchema,
})

export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>
