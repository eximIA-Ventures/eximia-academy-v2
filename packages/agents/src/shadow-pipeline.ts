import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { getModelWithFallback, type TenantPlan } from "./model-router"
import { captureException, startSpan } from "./telemetry"
import { buildPerfiladorPrompt, PERFILADOR_SYSTEM_PROMPT } from "./prompts/perfilador"
import { DETECTOR_SYSTEM_PROMPT } from "./prompts/detector"
import { type DetectorOutput, detectorOutputSchema } from "./schemas/detector"
import { type PerfiladorOutput, perfiladorOutputSchema } from "./schemas/perfilador"
import { withTimeout } from "./utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShadowInput {
  sessionId: string
  studentId: string
  tenantId: string
  studentMessage: string
  tutorResponse: string
  conversationHistory: Array<{ role: string; content: string }>
  chapterContent: string
  turnNumber: number
  model?: string
  tenantPlan?: TenantPlan
}

export interface ShadowPipelineConfig {
  detectorModel: string
  perfiladorModel: string
  timeoutMs: number
  perfiladorInterval: number
}

export const DEFAULT_SHADOW_CONFIG: ShadowPipelineConfig = {
  detectorModel: "gpt-4.1-mini",
  perfiladorModel: "gpt-4.1-mini",
  timeoutMs: 30000,
  perfiladorInterval: 5,
}

export interface ExistingLearnerProfile {
  engagement_style: string | null
  detail_orientation: string | null
  reasoning_style: string | null
  avg_depth_achieved: number | null
  avg_qa_score: number | null
  confidence: number | null
  kolb_grasping_axis: number | null
  kolb_transforming_axis: number | null
  kolb_dominant_style: string | null
  kolb_style_confidence: number | null
  strengths: string[]
  growth_areas: string[]
  adaptation_hints: string[]
  preferred_question_types: string[]
  comprehension_trend: string | null
  summary: string | null
  session_count: number
}

export interface ShadowResult {
  detector: DetectorOutput | null
  perfilador: PerfiladorOutput | null
  detectorError?: string
  perfiladorError?: string
}

// ---------------------------------------------------------------------------
// runDetector
// ---------------------------------------------------------------------------

export async function runDetector(
  input: ShadowInput,
  config: ShadowPipelineConfig = DEFAULT_SHADOW_CONFIG,
): Promise<DetectorOutput> {
  const historyText = input.conversationHistory
    .map((m) => `${m.role === "user" ? "Aluno" : "Tutor"}: ${m.content}`)
    .join("\n\n")

  const prompt = [
    "## Mensagem do Aluno (turno atual)",
    input.studentMessage,
    "",
    "## Resposta do Tutor (turno atual)",
    input.tutorResponse,
    "",
    "## Historico da Conversa",
    historyText || "Primeira interacao",
    "",
    "## Conteúdo do Capítulo",
    input.chapterContent.slice(0, 3000),
    "",
    `## Turno: ${input.turnNumber}`,
  ].join("\n")

  const result = await startSpan(
    { name: "agent.Detector", op: "ai.pipeline.shadow" },
    async (span) => {
      span.setAttribute("agent.name", "Detector")
      span.setAttribute("agent.model", config.detectorModel)
      return await withTimeout(
        (signal) =>
          generateObject({
            model: input.tenantPlan ? getModelWithFallback({ agentRole: "detector", tenantPlan: input.tenantPlan }) : openai(config.detectorModel),
            system: DETECTOR_SYSTEM_PROMPT,
            prompt,
            schema: detectorOutputSchema,
            abortSignal: signal,
          }),
        config.timeoutMs,
        "Detector",
      )
    },
  )

  return result.object
}

// ---------------------------------------------------------------------------
// runPerfilador
// ---------------------------------------------------------------------------

export function shouldRunPerfilador(turnNumber: number, interval: number = 5): boolean {
  return turnNumber > 0 && turnNumber % interval === 0
}

export async function runPerfilador(
  input: ShadowInput,
  existingProfile: ExistingLearnerProfile | null,
  detectorData: DetectorOutput,
  config: ShadowPipelineConfig = DEFAULT_SHADOW_CONFIG,
): Promise<PerfiladorOutput> {
  const sessionCount = existingProfile?.session_count ?? 0

  const previousProfile = existingProfile
    ? {
        engagement_style: existingProfile.engagement_style ?? "balanced",
        avg_depth_achieved: existingProfile.avg_depth_achieved ?? 3,
        avg_qa_score: existingProfile.avg_qa_score ?? 0.5,
        confidence: existingProfile.confidence ?? 0,
        strengths: existingProfile.strengths ?? [],
        growth_areas: existingProfile.growth_areas ?? [],
        kolb_profile: existingProfile.kolb_grasping_axis != null
          ? {
              grasping_axis: existingProfile.kolb_grasping_axis,
              transforming_axis: existingProfile.kolb_transforming_axis ?? 0,
              dominant_style: existingProfile.kolb_dominant_style ?? "divergente",
              style_confidence: existingProfile.kolb_style_confidence ?? 0,
            }
          : undefined,
        summary: existingProfile.summary ?? "",
      }
    : undefined

  const systemPrompt = buildPerfiladorPrompt({
    sessionCount,
    previousProfile,
    detectorData: {
      cognitive_patterns: detectorData.cognitive_patterns,
      linguistic_analysis: detectorData.linguistic_analysis,
      session_journey: detectorData.session_journey,
    },
  })

  const historyText = input.conversationHistory
    .map((m) => `${m.role === "user" ? "Aluno" : "Tutor"}: ${m.content}`)
    .join("\n\n")

  const prompt = [
    "## Historico Completo da Conversa",
    historyText || "Primeira interacao",
    "",
    "## Mensagem Atual do Aluno",
    input.studentMessage,
    "",
    `## Turno: ${input.turnNumber}`,
    `## Sessões Anteriores: ${sessionCount}`,
  ].join("\n")

  const result = await startSpan(
    { name: "agent.Perfilador", op: "ai.pipeline.shadow" },
    async (span) => {
      span.setAttribute("agent.name", "Perfilador")
      span.setAttribute("agent.model", config.perfiladorModel)
      span.setAttribute("agent.sessionCount", sessionCount)
      return await withTimeout(
        (signal) =>
          generateObject({
            model: input.tenantPlan ? getModelWithFallback({ agentRole: "perfilador", tenantPlan: input.tenantPlan }) : openai(config.perfiladorModel),
            system: systemPrompt,
            prompt,
            schema: perfiladorOutputSchema,
            abortSignal: signal,
          }),
        config.timeoutMs,
        "Perfilador",
      )
    },
  )

  return result.object
}

// ---------------------------------------------------------------------------
// Merge Incremental
// ---------------------------------------------------------------------------

function calculateConfidence(sessions: number, newConfidence: number): number {
  if (sessions <= 1) return Math.min(newConfidence, 0.15)
  if (sessions < 3) return Math.min(newConfidence, 0.3)
  if (sessions <= 10) return Math.min(newConfidence, 0.7)
  return Math.min(newConfidence, 0.9)
}

function mergeArrays(existing: string[], incoming: string[], max: number): string[] {
  const combined = [...new Set([...existing, ...incoming])]
  return combined.slice(0, max)
}

export function mergeProfileData(
  existing: ExistingLearnerProfile | null,
  newProfile: PerfiladorOutput,
  sessionCount: number,
): Record<string, unknown> {
  if (!existing) {
    return {
      engagement_style: newProfile.engagement_style,
      detail_orientation: newProfile.detail_orientation,
      reasoning_style: newProfile.reasoning_style,
      avg_depth_achieved: newProfile.avg_depth_achieved,
      avg_qa_score: newProfile.avg_qa_score,
      confidence: Math.min(newProfile.confidence, 0.15),
      kolb_grasping_axis: newProfile.kolb_profile.grasping_axis,
      kolb_transforming_axis: newProfile.kolb_profile.transforming_axis,
      kolb_dominant_style: newProfile.kolb_profile.dominant_style,
      kolb_style_confidence: newProfile.kolb_profile.style_confidence,
      strengths: newProfile.strengths.slice(0, 5),
      growth_areas: newProfile.growth_areas.slice(0, 3),
      adaptation_hints: newProfile.adaptation_hints.slice(0, 5),
      preferred_question_types: newProfile.preferred_question_types,
      comprehension_trend: newProfile.comprehension_trend,
      summary: newProfile.summary,
      session_count: 1,
      updated_at: new Date().toISOString(),
    }
  }

  const n = sessionCount
  const oldDepth = existing.avg_depth_achieved ?? 3
  const oldQa = existing.avg_qa_score ?? 0.5
  const oldGrasping = existing.kolb_grasping_axis ?? 0
  const oldTransforming = existing.kolb_transforming_axis ?? 0

  return {
    engagement_style: newProfile.engagement_style,
    detail_orientation: newProfile.detail_orientation,
    reasoning_style: newProfile.reasoning_style,
    avg_depth_achieved: (oldDepth * n + newProfile.avg_depth_achieved) / (n + 1),
    avg_qa_score: (oldQa * n + newProfile.avg_qa_score) / (n + 1),
    confidence: calculateConfidence(n + 1, newProfile.confidence),
    kolb_grasping_axis: (oldGrasping * n + newProfile.kolb_profile.grasping_axis) / (n + 1),
    kolb_transforming_axis: (oldTransforming * n + newProfile.kolb_profile.transforming_axis) / (n + 1),
    kolb_dominant_style: newProfile.kolb_profile.dominant_style,
    kolb_style_confidence: calculateConfidence(n + 1, newProfile.kolb_profile.style_confidence),
    strengths: mergeArrays(existing.strengths, newProfile.strengths, 5),
    growth_areas: newProfile.growth_areas.slice(0, 3),
    adaptation_hints: newProfile.adaptation_hints.slice(0, 5),
    preferred_question_types: newProfile.preferred_question_types,
    comprehension_trend: newProfile.comprehension_trend,
    summary: newProfile.summary,
    session_count: n + 1,
    updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Shadow Analytics Update Helper
// ---------------------------------------------------------------------------

export function buildAnalyticsUpdate(
  existingAnalytics: Record<string, unknown>,
  detectorOutput: DetectorOutput,
): Record<string, unknown> {
  return {
    ...existingAnalytics,
    cognitive_patterns: detectorOutput.cognitive_patterns.dominant_patterns.map((p) => p.pattern),
    defense_mechanisms: detectorOutput.cognitive_patterns.cognitive_loops,
    values_revealed: detectorOutput.cognitive_patterns.implicit_values,
    depth_progression: detectorOutput.session_journey.depth_progression,
    emotional_journey: detectorOutput.session_journey.emotional_arc,
    breakthrough_moments: detectorOutput.session_journey.breakthrough_candidates.length,
    depth_reached: detectorOutput.session_journey.depth_progression.length > 0
      ? Math.max(...detectorOutput.session_journey.depth_progression)
      : 0,
    emotional_density_progression: [
      ...((existingAnalytics.emotional_density_progression as number[]) ?? []),
      detectorOutput.linguistic_analysis.emotional_density,
    ],
    ai_detection: {
      probability: detectorOutput.ai_detection.probability,
      confidence: detectorOutput.ai_detection.confidence,
      verdict: detectorOutput.ai_detection.verdict,
      flag: detectorOutput.ai_detection.flag,
    },
    kolb_session_vector: {
      grasping_axis: (detectorOutput.linguistic_analysis.abstraction_level - 5.5) / 4.5,
      transforming_axis: detectorOutput.linguistic_analysis.certainty_vs_exploration,
      indicators_count: detectorOutput.cognitive_patterns.dominant_patterns.length,
    },
  }
}

// ---------------------------------------------------------------------------
// executeShadowPipeline — Fire-and-forget entry point
// ---------------------------------------------------------------------------

export interface ShadowPersistence {
  getExistingProfile: (studentId: string, tenantId: string) => Promise<ExistingLearnerProfile | null>
  getSessionAnalytics: (sessionId: string) => Promise<Record<string, unknown>>
  updateSessionAnalytics: (sessionId: string, analytics: Record<string, unknown>) => Promise<void>
  upsertLearnerProfile: (studentId: string, tenantId: string, data: Record<string, unknown>) => Promise<void>
}

export async function executeShadowPipeline(
  input: ShadowInput,
  persistence: ShadowPersistence,
  config: ShadowPipelineConfig = DEFAULT_SHADOW_CONFIG,
): Promise<ShadowResult> {
  const result: ShadowResult = { detector: null, perfilador: null }

  // Run Detector (always)
  const [detectorSettled] = await Promise.allSettled([
    runDetector(input, config),
  ])

  if (detectorSettled.status === "fulfilled") {
    result.detector = detectorSettled.value

    // Save analytics
    try {
      const existingAnalytics = await persistence.getSessionAnalytics(input.sessionId)
      const updatedAnalytics = buildAnalyticsUpdate(existingAnalytics, detectorSettled.value)
      await persistence.updateSessionAnalytics(input.sessionId, updatedAnalytics)
    } catch (error) {
      captureException(error, { tags: { pipeline: "shadow", agent: "Detector" } })
      result.detectorError = error instanceof Error ? error.message : "Unknown error saving analytics"
    }

    // Run Perfilador (conditionally)
    if (shouldRunPerfilador(input.turnNumber, config.perfiladorInterval)) {
      try {
        const existingProfile = await persistence.getExistingProfile(input.studentId, input.tenantId)
        const perfiladorOutput = await runPerfilador(input, existingProfile, detectorSettled.value, config)
        result.perfilador = perfiladorOutput

        const mergedData = mergeProfileData(existingProfile, perfiladorOutput, existingProfile?.session_count ?? 0)
        await persistence.upsertLearnerProfile(input.studentId, input.tenantId, mergedData)
      } catch (error) {
        captureException(error, { tags: { pipeline: "shadow", agent: "Perfilador" } })
        result.perfiladorError = error instanceof Error ? error.message : "Unknown error in Perfilador"
      }
    }
  } else {
    captureException(detectorSettled.reason, { tags: { pipeline: "shadow", agent: "Detector" } })
    result.detectorError = detectorSettled.reason instanceof Error
      ? detectorSettled.reason.message
      : "Unknown Detector error"
  }

  return result
}
