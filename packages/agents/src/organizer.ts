import { generateObject } from "ai"
import { type TenantPlan, getModelWithFallback } from "./model-router"
import { normalizeChapterMarkdown } from "./normalize-markdown"
import { ORGANIZER_CHUNK_SYSTEM_PROMPT, ORGANIZER_SYSTEM_PROMPT } from "./prompts/organizer"
import {
  type OrganizerInput,
  type OrganizerOutput,
  organizerOutputSchema,
} from "./schemas/organizer"
import { delay, getBackoffDelay, isRetryableError, withTimeout } from "./utils"

const DEFAULT_TIMEOUT_MS = 180_000
const MAX_ATTEMPTS = 2
const MAX_CHUNK_CHARS = 60_000
const CHUNK_OVERLAP_CHARS = 500

/** Post-process all chapter content to ensure proper markdown heading hierarchy. */
function normalizeOutput(output: OrganizerOutput): OrganizerOutput {
  return {
    ...output,
    chapters: output.chapters.map((ch) => ({
      ...ch,
      content: normalizeChapterMarkdown(ch.content),
    })),
  }
}

async function generateWithTimeout(
  userMessage: string,
  timeoutMs: number,
  systemPrompt: string = ORGANIZER_SYSTEM_PROMPT,
  plan: TenantPlan = "standard",
): Promise<OrganizerOutput> {
  const result = await withTimeout(
    (signal) =>
      generateObject({
        model: getModelWithFallback({ agentRole: "mestre", tenantPlan: plan }),
        system: systemPrompt,
        prompt: userMessage,
        schema: organizerOutputSchema,
        abortSignal: signal,
      }),
    timeoutMs,
    "Organizer",
  )
  return result.object
}

export function splitTextIntoChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChars

    if (end >= text.length) {
      chunks.push(text.slice(start))
      break
    }

    // Find the last paragraph boundary (\n\n) before the limit
    const searchRegion = text.slice(start, end)
    const lastParagraphBreak = searchRegion.lastIndexOf("\n\n")

    if (lastParagraphBreak > maxChars * 0.5) {
      // Found a good paragraph break in the second half
      end = start + lastParagraphBreak + 2 // include the \n\n
    } else {
      // No good paragraph break — try single newline
      const lastNewline = searchRegion.lastIndexOf("\n")
      if (lastNewline > maxChars * 0.5) {
        end = start + lastNewline + 1
      }
      // else: cut at maxChars (hard cut)
    }

    chunks.push(text.slice(start, end))

    // Next chunk starts with overlap for context continuity
    start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS)
  }

  return chunks
}

function mergeChunkResults(results: OrganizerOutput[], totalChunks: number): OrganizerOutput {
  // Use first chunk's title/description (typically has the introduction)
  const firstResult = results[0]

  // Concatenate all chapters, re-numbering order sequentially.
  // Preserve module_title from each chunk for proper grouping.
  const allChapters = results.flatMap((result) => result.chapters)
  const renumberedChapters = allChapters.map((chapter, index) => ({
    ...chapter,
    order: index,
  }))

  // Aggregate main_topics from all chunks (deduplicated)
  const allTopics = results.flatMap((r) => r.metadata.main_topics)
  const uniqueTopics = [...new Set(allTopics)]

  // Use highest complexity found across chunks
  const complexityOrder = { baixa: 0, media: 1, alta: 2 } as const
  const maxComplexity = results.reduce((max, r) => {
    return complexityOrder[r.metadata.content_complexity] > complexityOrder[max]
      ? r.metadata.content_complexity
      : max
  }, results[0].metadata.content_complexity)

  // Collect all warnings + add chunking warning
  const allWarnings = results.flatMap((r) => r.warnings ?? [])
  allWarnings.push(`Conteúdo extenso processado em ${totalChunks} partes`)

  return {
    suggested_title: firstResult.suggested_title,
    suggested_description: firstResult.suggested_description,
    chapters: renumberedChapters,
    metadata: {
      total_chapters: renumberedChapters.length,
      content_complexity: maxComplexity,
      main_topics: uniqueTopics,
      suggested_area: firstResult.metadata.suggested_area,
    },
    warnings: allWarnings,
  }
}

async function processChunkWithRetry(
  chunkText: string,
  input: OrganizerInput,
  chunkIndex: number,
  totalChunks: number,
  timeout: number,
  plan: TenantPlan = "standard",
): Promise<OrganizerOutput> {
  const userMessage = [
    `Tipo de fonte: ${input.source_type}`,
    input.source_filename ? `Arquivo: ${input.source_filename}` : "",
    input.instructions ? `Instrucoes do professor: ${input.instructions}` : "",
    `Idioma: ${input.language}`,
    `Maximo de capítulos: ${input.max_chapters}`,
    `[Parte ${chunkIndex + 1} de ${totalChunks}]`,
    "",
    "Conteúdo bruto:",
    chunkText,
  ]
    .filter(Boolean)
    .join("\n")

  let output: OrganizerOutput | undefined
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      output = await generateWithTimeout(userMessage, timeout, ORGANIZER_CHUNK_SYSTEM_PROMPT, plan)
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
    throw lastError ?? new Error(`Failed to organize chunk ${chunkIndex + 1}/${totalChunks}`)
  }

  return output
}

export async function organizeContent(
  input: OrganizerInput,
  config: { timeoutMs?: number; plan?: TenantPlan } = {},
): Promise<OrganizerOutput> {
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const plan = config.plan ?? "standard"

  // Small content: single call (original behavior)
  if (input.raw_text.length <= MAX_CHUNK_CHARS) {
    const userMessage = [
      `Tipo de fonte: ${input.source_type}`,
      input.source_filename ? `Arquivo: ${input.source_filename}` : "",
      input.instructions ? `Instrucoes do professor: ${input.instructions}` : "",
      `Idioma: ${input.language}`,
      `Maximo de capítulos: ${input.max_chapters}`,
      "",
      "Conteúdo bruto:",
      input.raw_text,
    ]
      .filter(Boolean)
      .join("\n")

    let output: OrganizerOutput | undefined
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        output = await generateWithTimeout(userMessage, timeout, ORGANIZER_SYSTEM_PROMPT, plan)
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
      throw lastError ?? new Error("Failed to organize content after retries")
    }

    return normalizeOutput(output)
  }

  // Large content: chunk, process sequentially, merge
  const chunks = splitTextIntoChunks(input.raw_text, MAX_CHUNK_CHARS)

  // Distribute max_chapters evenly across chunks to avoid explosion
  const chaptersPerChunk = Math.max(3, Math.ceil(input.max_chapters / chunks.length))
  const chunkInput: OrganizerInput = { ...input, max_chapters: chaptersPerChunk }

  const results: OrganizerOutput[] = []

  for (let i = 0; i < chunks.length; i++) {
    const result = await processChunkWithRetry(
      chunks[i],
      chunkInput,
      i,
      chunks.length,
      timeout,
      plan,
    )
    results.push(result)
  }

  return normalizeOutput(mergeChunkResults(results, chunks.length))
}
