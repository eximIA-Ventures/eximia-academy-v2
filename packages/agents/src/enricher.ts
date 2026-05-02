import { generateObject } from "ai"
import { getModelWithFallback, type TenantPlan } from "./model-router"
import {
  ENRICHER_EVAL_PROMPT,
  ENRICHER_INCORPORATE_PROMPT,
  ENRICHER_QUERY_PROMPT,
} from "./prompts/enricher"
import {
  type EnricherEvaluation,
  type EnricherIncorporateOutput,
  type EnricherSearchQueries,
  enricherEvaluationSchema,
  enricherIncorporateSchema,
  enricherSearchQueriesSchema,
} from "./schemas/enricher"
import { withTimeout, isRetryableError, delay, getBackoffDelay } from "./utils"

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 2

export async function generateSearchQueries(
  input: { chapterTitle: string; chapterContent: string; language?: string },
  config: { timeoutMs?: number; plan?: TenantPlan } = {},
): Promise<EnricherSearchQueries> {
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const plan = config.plan ?? "standard"

  const userMessage = [
    `Título do capítulo: ${input.chapterTitle}`,
    `Idioma: ${input.language ?? "pt-br"}`,
    "",
    "Conteúdo do capítulo:",
    input.chapterContent,
  ].join("\n")

  let output: EnricherSearchQueries | undefined
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await withTimeout(
        (signal) =>
          generateObject({
            model: getModelWithFallback({ agentRole: "mestre", tenantPlan: plan }),
            system: ENRICHER_QUERY_PROMPT,
            prompt: userMessage,
            schema: enricherSearchQueriesSchema,
            abortSignal: signal,
          }),
        timeout,
        "Enricher-QueryGen",
      )
      output = result.object
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_ATTEMPTS - 1 && isRetryableError(err)) {
        await delay(getBackoffDelay(attempt))
        continue
      }
      break
    }
  }

  if (!output) {
    throw lastError ?? new Error("Failed to generate search queries after retries")
  }

  return output
}

export async function evaluateSources(
  input: {
    chapterTitle: string
    chapterContent: string
    searchResults: Array<{ title: string; url: string; content: string }>
  },
  config: { timeoutMs?: number; plan?: TenantPlan } = {},
): Promise<EnricherEvaluation> {
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const plan = config.plan ?? "standard"

  const resultsText = input.searchResults
    .map(
      (r, i) => `### Resultado ${i + 1}\nTitulo: ${r.title}\nURL: ${r.url}\nConteúdo: ${r.content}`,
    )
    .join("\n\n")

  const userMessage = [
    `Título do capítulo: ${input.chapterTitle}`,
    "",
    "Conteúdo do capítulo:",
    input.chapterContent,
    "",
    "---",
    "",
    "Resultados de busca encontrados:",
    resultsText,
  ].join("\n")

  let output: EnricherEvaluation | undefined
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await withTimeout(
        (signal) =>
          generateObject({
            model: getModelWithFallback({ agentRole: "mestre", tenantPlan: plan }),
            system: ENRICHER_EVAL_PROMPT,
            prompt: userMessage,
            schema: enricherEvaluationSchema,
            abortSignal: signal,
          }),
        timeout,
        "Enricher-Eval",
      )
      output = result.object
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_ATTEMPTS - 1 && isRetryableError(err)) {
        await delay(getBackoffDelay(attempt))
        continue
      }
      break
    }
  }

  if (!output) {
    throw lastError ?? new Error("Failed to evaluate sources after retries")
  }

  return output
}

export async function incorporateSources(
  input: {
    chapterTitle: string
    chapterContent: string
    sources: Array<{ title: string; url: string; snippet: string }>
  },
  config: { timeoutMs?: number; plan?: TenantPlan } = {},
): Promise<EnricherIncorporateOutput> {
  const timeout = config.timeoutMs ?? 45_000
  const plan = config.plan ?? "standard"

  const sourcesText = input.sources
    .map((s, i) => `### Fonte ${i + 1}\nTitulo: ${s.title}\nURL: ${s.url}\nTrecho: ${s.snippet}`)
    .join("\n\n")

  const userMessage = [
    `Título do capítulo: ${input.chapterTitle}`,
    "",
    "Conteúdo original do capítulo:",
    input.chapterContent,
    "",
    "---",
    "",
    "Fontes aprovadas para incorporacao:",
    sourcesText,
  ].join("\n")

  let output: EnricherIncorporateOutput | undefined
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await withTimeout(
        (signal) =>
          generateObject({
            model: getModelWithFallback({ agentRole: "mestre", tenantPlan: plan }),
            system: ENRICHER_INCORPORATE_PROMPT,
            prompt: userMessage,
            schema: enricherIncorporateSchema,
            abortSignal: signal,
          }),
        timeout,
        "Enricher-Incorporate",
      )
      output = result.object
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_ATTEMPTS - 1 && isRetryableError(err)) {
        await delay(getBackoffDelay(attempt))
        continue
      }
      break
    }
  }

  if (!output) {
    throw lastError ?? new Error("Failed to incorporate sources after retries")
  }

  return output
}
