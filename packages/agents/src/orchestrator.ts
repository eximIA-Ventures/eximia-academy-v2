import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { generateObject } from "ai"
import { getModelWithFallback, type AgentRole, type TenantPlan } from "./model-router"
import { startSpan } from "./telemetry"
import { EDITOR_SYSTEM_PROMPT } from "./prompts/editor"
import { SOCRATES_SYSTEM_PROMPT } from "./prompts/socrates"
import { TESTER_SYSTEM_PROMPT } from "./prompts/tester"
import { type EditorOutput, editorOutputSchema } from "./schemas/editor"
import { type SocratesOutput, socratesOutputSchema } from "./schemas/socrates"
import { type TesterOutput, testerOutputSchema } from "./schemas/tester"
import {
  type AgentPipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  type OrchestratorInput,
  type PipelineResult,
} from "./types"
import { withTimeout } from "./utils"

interface AgentResult<T> {
  object: T
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined }
}

/** Sanitize a free-text profile field to prevent prompt injection */
function sanitizeProfileText(text: string, maxLen = 200): string {
  return text
    .replace(/[#<>{}[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, maxLen)
}

/** Select model: explicit override bypasses router (D24) */
function selectModel(role: AgentRole, config: AgentPipelineConfig, tenantPlan?: TenantPlan): LanguageModel {
  if (config.model !== DEFAULT_PIPELINE_CONFIG.model) {
    return openai(config.model)
  }
  return getModelWithFallback({ agentRole: role, tenantPlan })
}

function buildStudentProfileContext(
  profile: NonNullable<OrchestratorInput["studentProfile"]>,
): string {
  const lines: string[] = []

  if (profile.big_five) {
    const bf = profile.big_five
    if (bf.openness >= 4)
      lines.push(
        "Alta abertura a experiencias — use exemplos criativos e conexoes interdisciplinares",
      )
    if (bf.openness <= 2) lines.push("Baixa abertura — prefira exemplos concretos e praticos")
    if (bf.extraversion <= 2)
      lines.push("Baixa extroversão — de tempo para reflexão, não pressione por respostas rápidas")
    if (bf.extraversion >= 4)
      lines.push("Alta extroversão — pode usar abordagem mais dinamica e interativa")
    if (bf.neuroticism >= 4) lines.push("Alto neuroticismo — seja acolhedor, evite criar ansiedade")
    if (bf.conscientiousness >= 4)
      lines.push("Alta conscienciosidade — aprecia estrutura e organizacao")
  }

  if (profile.enneagram) {
    const ennTips: Record<number, string> = {
      1: "Tipo 1 (Perfeccionista) — valorize precisao, mas incentive flexibilidade",
      2: "Tipo 2 (Auxiliador) — use exemplos de impacto nas pessoas",
      3: "Tipo 3 (Realizador) — conecte aprendizado a resultados e conquistas",
      4: "Tipo 4 (Individualista) — valorize perspectivas unicas e criatividade",
      5: "Tipo 5 (Investigador) — ofereca profundidade e tempo para analise",
      6: "Tipo 6 (Leal) — seja consistente e transparente na abordagem",
      7: "Tipo 7 (Entusiasta) — mantenha dinamismo e variedade nos exemplos",
      8: "Tipo 8 (Desafiador) — seja direto e apresente desafios intelectuais",
      9: "Tipo 9 (Pacificador) — seja acolhedor e evite confronto desnecessario",
    }
    const tip = ennTips[profile.enneagram.type]
    if (tip) lines.push(tip)
  }

  if (profile.disc) {
    const d = profile.disc
    const dominant = Object.entries(d).sort(([, a], [, b]) => b - a)[0][0]
    const discTips: Record<string, string> = {
      d: "Perfil D dominante — seja direto e focado em resultados",
      i: "Perfil I dominante — seja entusiasta e use exemplos sociais",
      s: "Perfil S dominante — seja paciente, evite pressão por respostas rápidas",
      c: "Perfil C dominante — use logica, dados e abordagem estruturada",
    }
    if (discTips[dominant]) lines.push(discTips[dominant])
  }

  if (profile.multiple_intelligences) {
    const sorted = Object.entries(profile.multiple_intelligences).sort(([, a], [, b]) => b - a)
    const top2 = sorted.slice(0, 2).map(([k]) => k)
    const intelTips: Record<string, string> = {
      linguistic: "use analogias verbais e narrativas",
      logical: "use analogias estruturadas e raciocinio logico",
      spatial: "sugira diagramas e visualizacoes",
      musical: "use ritmo e padroes nas explicacoes",
      kinesthetic: "sugira atividades praticas e experimentacao",
      interpersonal: "use exemplos de colaboracao e impacto social",
      intrapersonal: "incentive reflexão pessoal e autoavaliacao",
      naturalist: "use analogias com sistemas e padroes naturais",
    }
    lines.push(
      `Inteligencias dominantes: ${top2.join(", ")} — ${top2
        .map((k) => intelTips[k] ?? "")
        .filter(Boolean)
        .join("; ")}`,
    )
  }

  if (profile.learning_style) {
    lines.push(`Estilo de aprendizagem: ${sanitizeProfileText(profile.learning_style)}`)
  }

  // AI Learning Profile hints (Epic 10)
  if (profile.ai_learning_profile?.adaptation_hints?.length) {
    for (const hint of profile.ai_learning_profile.adaptation_hints.slice(0, 5)) {
      lines.push(sanitizeProfileText(hint))
    }
  }
  if (profile.ai_learning_profile?.preferred_question_types?.length) {
    lines.push(
      `Tipos de pergunta que funcionam melhor: ${profile.ai_learning_profile.preferred_question_types.join(", ")}`,
    )
  }
  if (profile.ai_learning_profile?.engagement_style) {
    const styleTips: Record<string, string> = {
      reflective: "Aluno reflexivo — de tempo para pensar, não pressione",
      impulsive: "Aluno impulsivo — peca para elaborar antes de responder",
      balanced: "",
    }
    const tip = styleTips[profile.ai_learning_profile.engagement_style]
    if (tip) lines.push(tip)
  }

  return lines.filter(Boolean).join("\n")
}

async function runSocrates(
  input: OrchestratorInput,
  config: AgentPipelineConfig,
  testerFeedback?: string,
  tenantPlan?: TenantPlan,
): Promise<AgentResult<SocratesOutput>> {
  const historyText = input.conversationHistory
    .map((m) => `${m.role === "user" ? "Aluno" : "Tutor"}: ${m.content}`)
    .join("\n\n")

  // WS2 Bloom → expectedDepth mapping (D13, §11.4)
  const bloomDepthMap: Record<string, string> = {
    remembering: "1-2", understanding: "2-3", applying: "3-4",
    analyzing: "4-5", evaluating: "5-6", creating: "6-7",
  }
  const ws2Context = []
  if (input.interactionType) {
    ws2Context.push(`## Tipo de Interação: ${input.interactionType}`)
  }
  if (input.bloomTarget) {
    const depth = bloomDepthMap[input.bloomTarget] || "3-4"
    ws2Context.push(`## Bloom Target: ${input.bloomTarget} (profundidade esperada: ${depth})`)
  }

  const userMessage = [
    "## Contexto do Capítulo",
    input.chapterContent,
    "",
    "## Pergunta Inicial",
    input.question.text,
    "",
    `## Interacoes Restantes: ${input.interactionsRemaining}`,
    "",
    ...ws2Context,
    ws2Context.length > 0 ? "" : "",
    historyText ? `## Historico da Conversa\n${historyText}\n` : "",
    testerFeedback
      ? `## Feedback do Tester (melhore com base neste feedback)\n${testerFeedback}\n`
      : "",
    input.studentProfile
      ? `## Perfil do Aluno (adapte sua abordagem)\n${buildStudentProfileContext(input.studentProfile)}\n`
      : "",
    "## Mensagem do Aluno",
    input.studentMessage,
  ]
    .filter(Boolean)
    .join("\n")

  const result = await withTimeout(
    (signal) =>
      generateObject({
        model: selectModel("mestre", config, tenantPlan),
        system: SOCRATES_SYSTEM_PROMPT,
        prompt: userMessage,
        schema: socratesOutputSchema,
        abortSignal: signal,
      }),
    config.timeoutMs,
    "Socrates",
  )

  return { object: result.object, usage: result.usage }
}

async function runEditor(
  socratesResponse: string,
  context: { chapterTitle?: string; studentMessage: string; turnNumber: number },
  config: AgentPipelineConfig,
  tenantPlan?: TenantPlan,
): Promise<AgentResult<EditorOutput>> {
  const userMessage = [
    "## Resposta do Orientador",
    socratesResponse,
    "",
    "## Contexto",
    context.chapterTitle ? `Capítulo: ${context.chapterTitle}` : "",
    `Mensagem do aluno: ${context.studentMessage}`,
    `Turno: ${context.turnNumber}`,
  ]
    .filter(Boolean)
    .join("\n")

  const result = await withTimeout(
    (signal) =>
      generateObject({
        model: selectModel("polidor", config, tenantPlan),
        system: EDITOR_SYSTEM_PROMPT,
        prompt: userMessage,
        schema: editorOutputSchema,
        abortSignal: signal,
      }),
    config.timeoutMs,
    "Editor",
  )

  return { object: result.object, usage: result.usage }
}

async function runTester(
  editedResponse: string,
  context: { chapterTitle?: string; studentMessage: string; turnNumber: number },
  config: AgentPipelineConfig,
  tenantPlan?: TenantPlan,
): Promise<AgentResult<TesterOutput>> {
  const userMessage = [
    "## Resposta Editada para Validacao",
    editedResponse,
    "",
    "## Contexto",
    context.chapterTitle ? `Capítulo: ${context.chapterTitle}` : "",
    `Mensagem do aluno: ${context.studentMessage}`,
    `Turno: ${context.turnNumber}`,
  ]
    .filter(Boolean)
    .join("\n")

  const result = await withTimeout(
    (signal) =>
      generateObject({
        model: selectModel("guardiao", config, tenantPlan),
        system: TESTER_SYSTEM_PROMPT,
        prompt: userMessage,
        schema: testerOutputSchema,
        abortSignal: signal,
      }),
    config.timeoutMs,
    "Tester",
  )

  return { object: result.object, usage: result.usage }
}

/**
 * Orchestrates the Socratic dialogue pipeline:
 * Socrates → Editor → Tester (with retry on REJECTED)
 */
export async function orchestrateSocraticDialogue(
  input: OrchestratorInput,
  config: Partial<AgentPipelineConfig> = {},
): Promise<PipelineResult> {
  const fullConfig: AgentPipelineConfig = {
    ...DEFAULT_PIPELINE_CONFIG,
    ...config,
    ...(input.model ? { model: input.model } : {}),
  }

  let bestResponse = ""
  let bestScore = -1
  let bestQaReport: TesterOutput | null = null
  let retryCount = 0
  let testerFeedback: string | undefined
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    // Step 1: Run Socrates
    const socratesResult = await startSpan(
      { name: "agent.Socrates", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Socrates")
        span.setAttribute("agent.step", 1)
        span.setAttribute("agent.retry_count", attempt)
        return await runSocrates(input, fullConfig, testerFeedback, input.tenantPlan)
      },
    )
    totalInputTokens += socratesResult.usage?.inputTokens ?? 0
    totalOutputTokens += socratesResult.usage?.outputTokens ?? 0
    const responseContent = socratesResult.object.response.content

    // Step 2: Run Editor
    const editorResult = await startSpan(
      { name: "agent.Editor", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Editor")
        span.setAttribute("agent.step", 2)
        span.setAttribute("agent.retry_count", attempt)
        return await runEditor(
          responseContent,
          {
            studentMessage: input.studentMessage,
            turnNumber: input.turnNumber,
          },
          fullConfig,
          input.tenantPlan,
        )
      },
    )
    totalInputTokens += editorResult.usage?.inputTokens ?? 0
    totalOutputTokens += editorResult.usage?.outputTokens ?? 0
    const editedContent = editorResult.object.edited_response.content

    // Step 3: Run Tester
    const testerResult = await startSpan(
      { name: "agent.Tester", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Tester")
        span.setAttribute("agent.step", 3)
        span.setAttribute("agent.retry_count", attempt)
        return await runTester(
          editedContent,
          {
            studentMessage: input.studentMessage,
            turnNumber: input.turnNumber,
          },
          fullConfig,
          input.tenantPlan,
        )
      },
    )

    totalInputTokens += testerResult.usage?.inputTokens ?? 0
    totalOutputTokens += testerResult.usage?.outputTokens ?? 0
    const tester = testerResult.object

    // Track best response
    if (tester.score > bestScore) {
      bestScore = tester.score
      bestResponse = editedContent
      bestQaReport = tester
    }

    if (tester.verdict === "APPROVED") {
      return {
        response: editedContent,
        qaReport: {
          verdict: tester.verdict,
          score: tester.score,
          criteriaResults: tester.criteria_results,
          recommendation: tester.recommendation,
        },
        retryCount: attempt,
        warning: false,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      }
    }

    // Tester REJECTED — prepare feedback for retry
    retryCount = attempt + 1
    testerFeedback = tester.recommendation
  }

  // Max retries exceeded — return best response with warning
  return {
    response: bestResponse,
    qaReport: {
      verdict: bestQaReport?.verdict ?? "REJECTED",
      score: bestQaReport?.score ?? 0,
      criteriaResults: bestQaReport?.criteria_results ?? {},
      recommendation: bestQaReport?.recommendation ?? "Max retries exceeded",
    },
    retryCount,
    warning: true,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  }
}
