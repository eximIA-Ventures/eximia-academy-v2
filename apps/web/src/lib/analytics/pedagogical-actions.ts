// ---------------------------------------------------------------------------
// Pedagogical Actions — FASE 2 (item 1.3 "ações pedagógicas avançadas")
// ---------------------------------------------------------------------------
// Higher-order pedagogical levers (DISTINCT from the operational email/notify
// nudges in components/analytics/next-best-action.tsx). Three kinds, exactly as
// Hugo decided:
//   (a) reopen_reflection  — DETERMINISTIC. The module/chapter with the LOWEST
//       reflection index (reflections written ÷ potential) is surfaced so its
//       reflection can be reopened. No product mechanism to "reopen" exists yet,
//       so the action points at the module and is consumed as a nudge/pointer
//       (see followups). This lib does the deterministic selection only.
//   (b) concept_clinic     — AI (semantic over reflections/sessions). The route
//       layer calls the LLM; this lib only BUILDS the prompt and PARSES/validates
//       the model output into PedagogicalAction (kind=concept_clinic).
//   (c) reflection_to_case — AI. The route identifies HIGH-DEPTH reflections
//       (ranked by the author's session avgDepth, the only depth signal we have —
//       slide_reflections has no depth/score column), then this lib builds the
//       prompt and parses the model output into PedagogicalAction
//       (kind=reflection_to_case).
//
// SCOPE / DESIGN DECISIONS (enforced):
//   • This module is PURE of I/O for the deterministic path (reopen_reflection):
//     it receives already-fetched, tenant-scoped rows and returns actions. No
//     fetch, no Supabase, no Date.now in the deterministic functions — fully
//     testable. The AI path is split into a pure prompt-builder + a pure parser
//     so the route owns the only network call (mirrors insights/route.ts).
//   • SECURITY: this lib never reads the DB and never trusts a tenant from the
//     client. The CALLER (route) validates auth + role + tenant and passes only
//     tenant-scoped data in. No PII of other students is emitted — reflection
//     samples are anonymized to plain text before any prompt is built.
//   • Reuses the shared PedagogicalAction / PedagogicalActionKind contract from
//     types/analytics.ts. Reuses AlertSeverity for severity ordering.
// ---------------------------------------------------------------------------

import type { AlertSeverity, PedagogicalAction } from "@/types/analytics"

// ===========================================================================
// (a) REABRIR REFLEXÃO — deterministic lowest-reflection-index module
// ===========================================================================

/**
 * The minimal per-module reflection-index input the deterministic selector needs.
 * Structurally a subset of ModuleIndicator (types/analytics.ts) so a caller can
 * pass `aggregateResponse.indicators.perModule` straight through.
 */
export interface ModuleReflectionIndex {
  chapterId: string
  chapterTitle: string
  /** Reflections actually written in the module (realized numerator). */
  reflectionsWritten: number
  /** Reflection capacity of the module (potential denominator). */
  reflectionPotential: number
  /** Realized ÷ potential, 0–100 (already clamped upstream). */
  reflectionIndexPct: number
}

/** Options for {@link buildReopenReflectionAction}. */
export interface ReopenReflectionOptions {
  /**
   * A module is only a candidate if it has real reflection capacity. A module
   * with reflectionPotential === 0 is skipped (no prompts to reopen → not a
   * "low index", just "no opportunity"). Default 1.
   */
  minPotential?: number
  /**
   * Index (0–100) at/under which the lowest module is flagged as "crítico" vs
   * "atenção" for UI ordering. Default 25 (≤25% reflexões escritas → crítico).
   */
  criticalIndexPct?: number
}

const DEFAULT_REOPEN_OPTIONS: Required<ReopenReflectionOptions> = {
  minPotential: 1,
  criticalIndexPct: 25,
}

/**
 * (a) DETERMINISTIC. Picks the module with the LOWEST reflection index (among
 * modules that actually have reflection capacity) and returns a
 * `reopen_reflection` PedagogicalAction targeting that chapter. Returns null
 * when there is no eligible module (none with potential, or list empty) — the
 * caller then simply omits the action.
 *
 * PURE: no I/O, no clock, identical input → identical output. Ties broken
 * deterministically by lowest reflectionsWritten, then chapterId (stable).
 *
 * NOTE: there is NO product mechanism to literally "reopen" a reflection today.
 * The action therefore points at the module (targetIds = [chapterId]) and is
 * consumed as a nudge / link to the module screen (see followups in the route).
 */
export function buildReopenReflectionAction(
  perModule: ModuleReflectionIndex[],
  options: ReopenReflectionOptions = {},
): PedagogicalAction | null {
  const opts = { ...DEFAULT_REOPEN_OPTIONS, ...options }

  const eligible = perModule.filter((m) => m.reflectionPotential >= opts.minPotential)
  if (eligible.length === 0) return null

  // Lowest index first; ties → fewest reflections written; then stable by id.
  const sorted = [...eligible].sort((a, b) => {
    if (a.reflectionIndexPct !== b.reflectionIndexPct)
      return a.reflectionIndexPct - b.reflectionIndexPct
    if (a.reflectionsWritten !== b.reflectionsWritten)
      return a.reflectionsWritten - b.reflectionsWritten
    return a.chapterId.localeCompare(b.chapterId)
  })

  const target = sorted[0]
  const severity: AlertSeverity =
    target.reflectionIndexPct <= opts.criticalIndexPct ? "critico" : "atencao"

  return {
    kind: "reopen_reflection",
    title: `Reabrir reflexão: ${target.chapterTitle}`,
    detail: `Módulo com o menor índice de reflexão (${target.reflectionIndexPct}% — ${target.reflectionsWritten} de ${target.reflectionPotential} reflexões escritas). Recomenda-se reabrir/reforçar a reflexão deste módulo com a turma.`,
    targetIds: [target.chapterId],
    severity,
  }
}

// ===========================================================================
// (b) CLÍNICA DOS 3 CONCEITOS MAIS FRÁGEIS — AI prompt + parser (pure halves)
// ===========================================================================

/**
 * An anonymized text sample fed to the concept-clinic prompt. NO student id,
 * NO name — only the free text and a coarse depth bucket (when known) so the
 * model can weigh struggling vs. fluent samples. The route MUST anonymize
 * before building the prompt.
 */
export interface AnonymizedSample {
  /** Free text (reflection response or a student turn from a session). */
  text: string
  /** Coarse source tag for the model's context, never a real id. */
  source: "reflection" | "session"
  /** Session depth bucket (1–7) when the sample comes from a session; else null. */
  depth?: number | null
}

/** System prompt for the concept clinic — same provider/config as insights/route.ts. */
export const CONCEPT_CLINIC_SYSTEM_PROMPT = [
  'Você é um consultor pedagógico analisando reflexões e diálogos de alunos de uma plataforma de aprendizagem (eximIA Academy). Sua tarefa é identificar os 3 CONCEITOS em que os alunos demonstram MAIOR DIFICULDADE/FRAGILIDADE — confusão, aplicação incorreta, superficialidade ou ausência de compreensão. Para cada conceito, proponha uma breve "clínica prática" (exercício/atividade) que ajude a consolidá-lo.',
  "Responda APENAS em JSON válido, sem markdown:",
  '{ "concepts": [ { "concept": "...", "evidence": "...", "clinic": "..." } ] }',
  'Regras: máximo 3 conceitos; "concept" = nome curto (max 60 chars); "evidence" = por que é frágil (1 frase, max 160 chars); "clinic" = atividade sugerida (1 frase, max 160 chars). Use português brasileiro. NÃO inclua nomes de alunos.',
].join("\n")

/** Maximum samples embedded in a single concept-clinic prompt (token guardrail). */
export const CONCEPT_CLINIC_MAX_SAMPLES = 40
/** Maximum characters per sample embedded in the prompt (token guardrail). */
export const SAMPLE_MAX_CHARS = 600

/** Truncates a sample to SAMPLE_MAX_CHARS and strips control/newline noise. */
function clampSample(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim()
  return oneLine.length > SAMPLE_MAX_CHARS ? `${oneLine.slice(0, SAMPLE_MAX_CHARS)}…` : oneLine
}

/**
 * Builds the user prompt for the concept clinic from anonymized samples. PURE:
 * no I/O. Caps the number of samples and per-sample length so the prompt stays
 * bounded (a caller cannot inflate the LLM cost). Returns null when there are no
 * usable samples (the route should then skip the clinic, not call the LLM).
 */
export function buildConceptClinicPrompt(samples: AnonymizedSample[]): string | null {
  const usable = samples
    .map((s) => ({ ...s, text: clampSample(s.text) }))
    .filter((s) => s.text.length > 0)
  if (usable.length === 0) return null

  const capped = usable.slice(0, CONCEPT_CLINIC_MAX_SAMPLES)
  const lines = capped.map((s, i) => {
    const depthTag =
      typeof s.depth === "number" && s.depth > 0 ? ` (profundidade ${s.depth}/7)` : ""
    return `[${i + 1}] (${s.source}${depthTag}) ${s.text}`
  })

  return `Analise as amostras anonimizadas abaixo (reflexões e turnos de alunos) e identifique os 3 conceitos com MAIOR fragilidade de compreensão.\n\nAMOSTRAS:\n${lines.join("\n")}`
}

/** One concept the model judged fragile (shape of the LLM JSON items). */
export interface FragileConcept {
  concept: string
  evidence: string
  clinic: string
}

/**
 * Parses + validates the concept-clinic LLM JSON into a single concept_clinic
 * PedagogicalAction. PURE: no I/O. Tolerates markdown fences and missing fields,
 * caps at 3 concepts, and returns null when nothing usable was produced (the
 * route then omits the action rather than emitting an empty card).
 *
 * targetIds carries the concept LABELS (no DB ids exist for concepts) so the UI
 * can chip them — matching the integrationNotes contract for concept_clinic.
 */
export function parseConceptClinic(rawContent: string): PedagogicalAction | null {
  const concepts = safeParseConcepts(rawContent)
  if (concepts.length === 0) return null

  const top = concepts.slice(0, 3)
  const labels = top.map((c) => c.concept)
  const detail = top.map((c) => `• ${c.concept}: ${c.clinic}`).join(" ")

  return {
    kind: "concept_clinic",
    title: "Clínica prática: 3 conceitos mais frágeis",
    detail: `Conceitos com maior fragilidade detectada: ${labels.join(", ")}.${detail ? ` Atividades sugeridas: ${detail}` : ""}`,
    targetIds: labels,
    severity: "atencao",
  }
}

function safeParseConcepts(rawContent: string): FragileConcept[] {
  try {
    const cleaned = rawContent
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim()
    const parsed = JSON.parse(cleaned) as unknown
    const arr =
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { concepts?: unknown }).concepts)
        ? ((parsed as { concepts: unknown[] }).concepts as unknown[])
        : Array.isArray(parsed)
          ? (parsed as unknown[])
          : []
    const out: FragileConcept[] = []
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue
      const rec = item as Record<string, unknown>
      const concept = typeof rec.concept === "string" ? rec.concept.trim().slice(0, 60) : ""
      if (!concept) continue
      out.push({
        concept,
        evidence: typeof rec.evidence === "string" ? rec.evidence.trim().slice(0, 160) : "",
        clinic: typeof rec.clinic === "string" ? rec.clinic.trim().slice(0, 160) : "",
      })
    }
    return out
  } catch {
    return []
  }
}

// ===========================================================================
// (c) TRANSFORMAR REFLEXÃO EM CASO — AI prompt + parser (pure halves)
// ===========================================================================

/**
 * A single HIGH-DEPTH reflection candidate to turn into a learning case. The
 * route selects these (ranked by the author's session avgDepth — the only depth
 * proxy, since slide_reflections has no depth column) and anonymizes them.
 * `reflectionId` is kept ONLY so the resulting action can target it; it is NOT
 * embedded in the prompt (no ids leak to the model).
 */
export interface HighDepthReflection {
  /** slide_reflections.id — used for targetIds, never sent to the LLM. */
  reflectionId: string
  /** Anonymized reflection text. */
  text: string
  /** Author's session avgDepth (1–7) used to rank "high depth". */
  depth: number
}

/** System prompt for reflection→case — same provider/config as insights/route.ts. */
export const REFLECTION_TO_CASE_SYSTEM_PROMPT = [
  'Você é um designer instrucional. Recebe UMA reflexão de alta profundidade de um aluno (anônima) e a transforma num "caso de aprendizagem" curto e reutilizável para a turma: um resumo da situação/insight + 2 perguntas de discussão. NÃO use nomes de alunos.',
  "Responda APENAS em JSON válido, sem markdown:",
  '{ "title": "...", "summary": "...", "discussionQuestions": ["...", "..."] }',
  'Regras: "title" max 80 chars; "summary" max 280 chars; 2 perguntas, cada uma max 120 chars. Use português brasileiro.',
].join("\n")

/**
 * Builds the reflection→case prompt from a single anonymized high-depth
 * reflection. PURE: no I/O. Truncates the reflection to SAMPLE_MAX_CHARS.
 * Returns null when the reflection text is empty (route then skips it).
 */
export function buildReflectionToCasePrompt(reflection: HighDepthReflection): string | null {
  const text = clampSample(reflection.text)
  if (text.length === 0) return null
  return `Transforme a reflexão de alta profundidade abaixo (profundidade ${reflection.depth}/7) num caso de aprendizagem reutilizável.\n\nREFLEXÃO:\n${text}`
}

/** Shape of the reflection→case LLM JSON. */
export interface LearningCaseDraft {
  title: string
  summary: string
  discussionQuestions: string[]
}

/**
 * Parses + validates the reflection→case LLM JSON into a reflection_to_case
 * PedagogicalAction. PURE: no I/O. Returns null when nothing usable was produced.
 * `reflectionId` is echoed into targetIds (matching the integrationNotes
 * contract: source reflection/session id).
 */
export function parseReflectionToCase(
  rawContent: string,
  reflectionId: string,
): PedagogicalAction | null {
  const draft = safeParseLearningCase(rawContent)
  if (!draft) return null

  const questions =
    draft.discussionQuestions.length > 0
      ? ` Perguntas: ${draft.discussionQuestions.join(" / ")}`
      : ""

  return {
    kind: "reflection_to_case",
    title: draft.title || "Caso de aprendizagem (a partir de reflexão)",
    detail: `${draft.summary}${questions}`.trim(),
    targetIds: [reflectionId],
    severity: "positivo",
  }
}

function safeParseLearningCase(rawContent: string): LearningCaseDraft | null {
  try {
    const cleaned = rawContent
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (typeof parsed !== "object" || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    const title = typeof rec.title === "string" ? rec.title.trim().slice(0, 80) : ""
    const summary = typeof rec.summary === "string" ? rec.summary.trim().slice(0, 280) : ""
    if (!summary) return null // a case with no summary is useless
    const rawQuestions = Array.isArray(rec.discussionQuestions) ? rec.discussionQuestions : []
    const discussionQuestions = rawQuestions
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim().slice(0, 120))
      .filter((q) => q.length > 0)
      .slice(0, 2)
    return { title, summary, discussionQuestions }
  } catch {
    return null
  }
}
