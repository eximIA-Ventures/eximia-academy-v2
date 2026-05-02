import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { getModelWithFallback, type TenantPlan } from "./model-router"
import { AgentTimeoutError } from "./errors"
import { ANALYST_SYSTEM_PROMPT } from "./prompts/analyst"
import { type AnalystInput, analystOutputSchema } from "./schemas/analyst"
import { type AgentPipelineConfig, type AnalysisResult, DEFAULT_PIPELINE_CONFIG } from "./types"

/**
 * Runs the Analyst agent in parallel (non-blocking).
 * Analyzes student message for AI detection, metrics, and quality.
 */
export async function runAnalyst(
  input: AnalystInput,
  config: Partial<AgentPipelineConfig> = {},
  tenantPlan?: TenantPlan,
): Promise<AnalysisResult> {
  const fullConfig: AgentPipelineConfig = {
    ...DEFAULT_PIPELINE_CONFIG,
    ...config,
  }

  const userMessage = [
    "## Mensagem do Aluno para Analise",
    input.student_message,
    "",
    input.context?.chapter_title ? `## Capítulo: ${input.context.chapter_title}` : "",
    input.context?.turn_number ? `## Turno: ${input.context.turn_number}` : "",
    input.interaction_metadata?.session_id
      ? `## Session: ${input.interaction_metadata.session_id}`
      : "",
    input.interaction_metadata?.response_time_seconds !== undefined
      ? `## Tempo de resposta: ${input.interaction_metadata.response_time_seconds}s`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), fullConfig.timeoutMs)

  try {
    const { object } = await Promise.race([
      generateObject({
        model: tenantPlan ? getModelWithFallback({ agentRole: "analyst", tenantPlan }) : openai(fullConfig.model),
        system: ANALYST_SYSTEM_PROMPT,
        prompt: userMessage,
        schema: analystOutputSchema,
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new AgentTimeoutError("Analyst"))
        })
      }),
    ])

    return {
      analysisId: object.analysis_id,
      aiDetection: {
        probability: object.ai_detection.probability,
        confidence: object.ai_detection.confidence,
        verdict: object.ai_detection.verdict,
        indicators: object.ai_detection.indicators,
        flag: object.ai_detection.flag,
      },
      metrics: object.metrics,
      flags: object.flags,
      observations: object.observations,
      recommendation: object.recommendation,
    }
  } catch (error) {
    if (error instanceof AgentTimeoutError) throw error

    // Circuit breaker: return neutral result on error
    return {
      analysisId: `analysis_error_${Date.now()}`,
      aiDetection: {
        probability: 0.5,
        confidence: "low",
        verdict: "uncertain",
        indicators: [],
        flag: null,
      },
      metrics: {},
      flags: [],
      observations: ["Erro durante análise — resultado neutro"],
      recommendation: "Análise indisponivel. Monitorar manualmente.",
    }
  } finally {
    clearTimeout(timeout)
  }
}
