import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { getModelWithFallback, type TenantPlan } from "./model-router"
import { PROFILER_SYSTEM_PROMPT } from "./prompts/profiler"
import { type ProfilerInput, type ProfilerOutput, profilerOutputSchema } from "./schemas/profiler"
import { withTimeout } from "./utils"

export function buildProfilerPrompt(input: ProfilerInput): string {
  const messagesText = input.messages
    .map((m) => `${m.role === "user" ? "Aluno" : "Tutor"} (turno ${m.turn_number}): ${m.content}`)
    .join("\n\n")

  const questionSection = [
    `Pergunta: ${input.question.text}`,
    input.question.skill ? `Skill: ${input.question.skill}` : "",
    input.question.intention ? `Intencao: ${input.question.intention}` : "",
    input.question.expected_depth ? `Profundidade esperada: ${input.question.expected_depth}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const scoresText = input.qaScores
    .map((s, i) => `Turno ${i + 1}: score=${s.score.toFixed(2)}, verdict=${s.verdict}`)
    .join("\n")

  const profileSection = input.existingProfile
    ? JSON.stringify(input.existingProfile, null, 2)
    : "Nenhum perfil existente (primeira sessao)"

  return [
    "## Conversa Socratica",
    messagesText,
    "",
    "## Pergunta Inicial",
    questionSection,
    "",
    "## Scores de Qualidade",
    scoresText || "Nenhum score disponível",
    "",
    "## Perfil Existente",
    profileSection,
    "",
    "## Sessões Completadas",
    `Total de sessões anteriores: ${input.sessionCount}`,
  ].join("\n")
}

export async function runProfiler(
  input: ProfilerInput,
  config: { model?: string; timeoutMs?: number; tenantPlan?: TenantPlan } = {},
): Promise<ProfilerOutput> {
  const result = await withTimeout(
    (signal) =>
      generateObject({
        model: config.tenantPlan ? getModelWithFallback({ agentRole: "perfilador", tenantPlan: config.tenantPlan }) : openai(config.model ?? "gpt-4.1-mini"),
        system: PROFILER_SYSTEM_PROMPT,
        prompt: buildProfilerPrompt(input),
        schema: profilerOutputSchema,
        abortSignal: signal,
      }),
    config.timeoutMs ?? 15000,
    "Profiler",
  )
  return result.object
}
