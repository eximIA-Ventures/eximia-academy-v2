export interface AgentPipelineConfig {
  model: string
  maxRetries: number
  timeoutMs: number
}

export const DEFAULT_PIPELINE_CONFIG: AgentPipelineConfig = {
  model: "gpt-4.1",
  maxRetries: 2,
  timeoutMs: 30000,
}

export interface PipelineStep<TInput, TOutput> {
  name: string
  execute: (input: TInput, config: AgentPipelineConfig) => Promise<TOutput>
  timeout: number
  retryable: boolean
}

export interface PipelineResult {
  response: string
  qaReport: {
    verdict: string
    score: number
    criteriaResults: Record<string, unknown>
    recommendation: string
  }
  retryCount: number
  warning: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface AnalysisResult {
  analysisId: string
  aiDetection: {
    probability: number
    confidence: string
    verdict: string
    indicators: Array<{ type: string; description: string; weight: number }>
    flag: string | null
  }
  metrics: Record<string, unknown>
  flags: string[]
  observations: string[]
  recommendation: string
}

export interface ConversationMessage {
  role: string
  content: string
  turn_number?: number
}

// --- Interaction Types (Epic 17 — Stories 17.4, 17.5) ---
// Migrated to @eximia/shared (D19 modularization)

import type { InteractionType } from "@eximia/shared"
export type { InteractionType } from "@eximia/shared"

export type ClosingReason = "smart_closing" | "limit_reached" | "natural"

export interface InteractionConfig {
  max_interactions: number
  configured_by: "instructor" | "default"
  type_defaults: Record<InteractionType, number>
  smart_closing: {
    enabled: boolean
    min_interactions_before: number
    depth_threshold: number
    insights_threshold: number
    remaining_threshold: number
  }
}

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  max_interactions: 20,
  configured_by: "default",
  type_defaults: {
    socratic_dialogue: 20,
    quiz: 8,
    scenario: 12,
    assignment: 15,
  },
  smart_closing: {
    enabled: true,
    min_interactions_before: 5,
    depth_threshold: 6,
    insights_threshold: 2,
    remaining_threshold: 5,
  },
}

export interface InteractionInput {
  type: InteractionType
  content: string
  metadata?: {
    alternatives?: string[]
    rubric?: string[]
    context?: string
    expected_depth?: number
  }
}

export interface ClosingFlags {
  is_closing: boolean
  suggest_closing: boolean
  closing_reason: ClosingReason | null
}

export interface OrchestratorInput {
  sessionId: string
  studentMessage: string
  chapterContent: string
  question: { text: string; skill?: string; intention?: string; expected_depth?: string }
  conversationHistory: ConversationMessage[]
  turnNumber: number
  interactionsRemaining: number
  model?: string
  tenantPlan?: import("./model-router").TenantPlan
  // WS2 fields (D13) — optional, backward-compatible
  interactionType?: "socratic_dialogue" | "quiz" | "scenario" | "assignment"
  bloomTarget?: "remembering" | "understanding" | "applying" | "analyzing" | "evaluating" | "creating"
  studentProfile?: {
    big_five?: {
      openness: number
      conscientiousness: number
      extraversion: number
      agreeableness: number
      neuroticism: number
    }
    enneagram?: { type: number; wing?: number }
    disc?: { d: number; i: number; s: number; c: number }
    multiple_intelligences?: Record<string, number>
    learning_style?: string
    ai_profile?: { summary: string; strengths: string[]; learning_style: string }
    ai_learning_profile?: import("@eximia/shared").AILearningProfile
  }
}
