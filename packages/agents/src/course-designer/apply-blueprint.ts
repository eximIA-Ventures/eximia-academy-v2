/**
 * Apply Blueprint — Creates course + chapters + questions from an approved blueprint (D12)
 *
 * This module is LLM-only: it receives all needed data and returns structured output.
 * DB persistence happens in the API route that calls these functions.
 */

import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { normalizeChapterMarkdown } from "../normalize-markdown"

// --- Schemas ---

const chapterContentSchema = z.object({
  markdown: z.string().describe("Structured markdown content for the chapter with framework stage sections, key concepts, and activity placeholders"),
})

const questionSchema = z.object({
  text: z.string().describe("The question text"),
  skill: z.string().optional().describe("Cognitive skill being assessed"),
  intention: z.string().optional().describe("Pedagogical intention behind this question"),
  expected_depth: z.string().optional().describe("Expected cognitive depth (1-7 scale)"),
})

const moduleQuestionsSchema = z.object({
  questions: z.array(questionSchema),
})

// --- Types ---

export interface BlueprintModule {
  order: number
  title: string
  description: string | null
  durationMinutes: number | null
  interactionType: string | null
  bloomLevel: string | null
  frameworkStages: Array<{ stage: string; label?: string; durationMinutes?: number }>
  objectives: Array<{ objectiveStatement: string; bloomLevel: string }>
}

export interface ApplyBlueprintInput {
  blueprintId: string
  courseTitle: string
  courseDescription: string | null
  primaryFramework: string
  interactionStrategy: string | null
  modules: BlueprintModule[]
}

export interface GeneratedChapter {
  title: string
  content: string
  learningObjective: string | null
  order: number
  interactionType: string | null
  bloomTarget: string | null
}

export interface BlueprintGeneratedQuestion {
  chapterOrder: number
  text: string
  skill: string | null
  intention: string | null
  expectedDepth: string | null
}

export interface ApplyBlueprintResult {
  chapters: GeneratedChapter[]
  questions: BlueprintGeneratedQuestion[]
  interactionConfig: {
    configured_by: "blueprint"
    type_defaults: Record<string, { turns: number }>
    smart_closing: { enabled: boolean; grace_turns: number }
  }
}

// --- Constants ---

const QUESTIONS_PER_TYPE: Record<string, { min: number; max: number }> = {
  socratic_dialogue: { min: 3, max: 5 },
  quiz: { min: 5, max: 8 },
  scenario: { min: 2, max: 3 },
  assignment: { min: 1, max: 2 },
}

const TYPE_TURNS: Record<string, number> = {
  socratic_dialogue: 8,
  quiz: 5,
  scenario: 6,
  assignment: 4,
}

// --- Chapter Content Generation ---

async function generateChapterContent(
  module: BlueprintModule,
  framework: string,
  model: LanguageModel,
): Promise<string> {
  const stagesText = module.frameworkStages
    .map((s) => `- ${s.label || s.stage} (${s.durationMinutes || 0}min)`)
    .join("\n")

  const objectivesText = module.objectives
    .map((o) => `- [${o.bloomLevel}] ${o.objectiveStatement}`)
    .join("\n")

  const { object } = await generateObject({
    model,
    schema: chapterContentSchema,
    system: `Você é um designer instrucional criando conteúdo para capítulos de treinamento corporativo.
Gere conteúdo em markdown estruturado, rico e aplicável. Use linguagem profissional em português brasileiro.
Inclua seções alinhadas ao framework ${framework}, conceitos-chave com exemplos práticos,
e placeholders [ATIVIDADE PRÁTICA] para exercícios hands-on.

REGRAS DE FORMATAÇÃO MARKDOWN (OBRIGATÓRIAS):
- Use ## para títulos de seção (ex: ## Introdução, ## Conceitos-Chave)
- Use ### para sub-seções dentro de cada seção
- Use #### para tópicos detalhados dentro de sub-seções
- NUNCA use texto em negrito (**Titulo**) como substituto de heading — SEMPRE use ## / ### / ####
- Deixe uma linha em branco ANTES e DEPOIS de cada heading
- Use **negrito** apenas para termos-chave DENTRO de parágrafos
- O conteúdo DEVE ter hierarquia visual clara — um leitor deve conseguir escanear os headings e entender a estrutura`,
    prompt: `Gere o conteúdo do capítulo "${module.title}".

Descrição: ${module.description || "N/A"}
Duração: ${module.durationMinutes || 60} minutos
Framework: ${framework}
Tipo de Interação: ${module.interactionType || "socratic_dialogue"}

Stages do Framework:
${stagesText || "N/A"}

Objetivos de Aprendizagem:
${objectivesText || "N/A"}

Bloom Level: ${module.bloomLevel || "applying"}

Gere markdown com:
1. Uma seção ## por stage do framework
2. Sub-seções ### para conceitos dentro de cada stage
3. Conceitos-chave com exemplos práticos
4. Placeholders [ATIVIDADE PRÁTICA] para exercícios
5. Resumo dos pontos principais ao final

IMPORTANTE: Use headings markdown (## / ### / ####) para toda hierarquia. Nunca use **negrito** como título.`,
    abortSignal: AbortSignal.timeout(60_000),
  })

  return normalizeChapterMarkdown(object.markdown)
}

// --- Questions Generation ---

async function generateModuleQuestions(
  module: BlueprintModule,
  chapterContent: string,
  model: LanguageModel,
): Promise<BlueprintGeneratedQuestion[]> {
  const interactionType = module.interactionType || "socratic_dialogue"
  const limits = QUESTIONS_PER_TYPE[interactionType] || QUESTIONS_PER_TYPE.socratic_dialogue
  const count = limits.max

  const objectivesText = module.objectives
    .map((o) => `- [${o.bloomLevel}] ${o.objectiveStatement}`)
    .join("\n")

  const typeInstructions: Record<string, string> = {
    socratic_dialogue: `Gere ${count} perguntas abertas, profundas e socráticas que estimulem reflexão crítica.
Cada pergunta deve provocar pensamento profundo e aplicação prática.`,
    quiz: `Gere ${count} perguntas de quiz variadas: múltipla escolha, verdadeiro/falso, e resposta curta.
Cada pergunta deve avaliar compreensão dos conceitos-chave.`,
    scenario: `Gere ${count} cenários com dilemas e trade-offs relevantes ao contexto corporativo.
Cada cenário deve apresentar uma situação complexa que exija análise e tomada de decisão.`,
    assignment: `Gere ${count} atividades práticas com entregável definido.
Cada assignment deve ser aplicável ao contexto real de trabalho do participante.`,
  }

  const { object } = await generateObject({
    model,
    schema: moduleQuestionsSchema,
    system: `Você é um designer instrucional criando avaliações para treinamento corporativo.
Gere perguntas/atividades em português brasileiro, alinhadas ao nível Bloom indicado.`,
    prompt: `Gere perguntas/atividades para o módulo "${module.title}".

Tipo de Interação: ${interactionType}
Bloom Level: ${module.bloomLevel || "applying"}

Objetivos:
${objectivesText || "N/A"}

Contexto do conteúdo (resumo):
${chapterContent.slice(0, 2000)}

${typeInstructions[interactionType] || typeInstructions.socratic_dialogue}`,
    abortSignal: AbortSignal.timeout(60_000),
  })

  return object.questions.map((q) => ({
    chapterOrder: module.order,
    text: q.text,
    skill: q.skill || null,
    intention: q.intention || null,
    expectedDepth: q.expected_depth || null,
  }))
}

// --- Main Apply Function ---

export async function applyBlueprint(
  input: ApplyBlueprintInput,
  model: LanguageModel,
): Promise<ApplyBlueprintResult> {
  const chapters: GeneratedChapter[] = []
  const questions: BlueprintGeneratedQuestion[] = []

  // Process modules sequentially to avoid rate limits
  for (const mod of input.modules.sort((a, b) => a.order - b.order)) {
    // Generate chapter content via AI
    const content = await generateChapterContent(mod, input.primaryFramework, model)

    const bloomTarget = mod.bloomLevel || mod.objectives[0]?.bloomLevel || null

    chapters.push({
      title: mod.title,
      content,
      learningObjective: mod.objectives[0]?.objectiveStatement || null,
      order: mod.order,
      interactionType: mod.interactionType || "socratic_dialogue",
      bloomTarget,
    })

    // Generate questions via AI
    const moduleQuestions = await generateModuleQuestions(mod, content, model)
    questions.push(...moduleQuestions)
  }

  // Build interaction config (§11.1)
  const typeDefaults: Record<string, { turns: number }> = {}
  for (const type of Object.keys(TYPE_TURNS)) {
    typeDefaults[type] = { turns: TYPE_TURNS[type] }
  }

  return {
    chapters,
    questions,
    interactionConfig: {
      configured_by: "blueprint",
      type_defaults: typeDefaults,
      smart_closing: { enabled: true, grace_turns: 2 },
    },
  }
}
