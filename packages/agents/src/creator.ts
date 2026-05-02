import { generateObject } from "ai"
import { getModelWithFallback, type TenantPlan } from "./model-router"
import { CREATOR_SYSTEM_PROMPT } from "./prompts/creator"
import { type CreatorInput, type CreatorOutput, creatorOutputSchema } from "./schemas/creator"

export async function generateQuestions(
  input: CreatorInput,
  plan: TenantPlan = "standard",
): Promise<CreatorOutput> {
  const userMessage = [
    `Capítulo: ${input.chapter_title ?? "Sem titulo"}`,
    "",
    "Conteúdo:",
    input.chapter_content,
    "",
    `Objetivo de aprendizagem: ${input.learning_objective ?? "Não especificado"}`,
    `Dificuldade: ${input.difficulty ?? "intermediario"}`,
    "",
    `Gere ${input.max_questions ?? 3} perguntas socraticas.`,
  ].join("\n")

  const { object } = await generateObject({
    model: getModelWithFallback({ agentRole: "mestre", tenantPlan: plan }),
    system: CREATOR_SYSTEM_PROMPT,
    prompt: userMessage,
    schema: creatorOutputSchema,
    abortSignal: AbortSignal.timeout(120_000), // 2 min timeout
  })

  return object
}
