/**
 * Auditor Agent — 7-step analysis of existing courses (Caminho B)
 *
 * Analyzes a course (chapters + questions) and produces:
 * 1. Structural extraction
 * 2. Content analysis (themes, concepts, Bloom levels)
 * 3. Quality audit (score 0-100, 5 dimensions)
 * 4. Gap identification
 * 5. Preservation map (MANTER/REORGANIZAR/MELHORAR/DESCARTAR)
 * 6. Improvement plan
 * 7. enriched_input for pre-filling the wizard
 */

import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { AUDITOR_SYSTEM_PROMPT } from "./prompts/auditor"

// --- Schema ---

const preservationStatus = z.enum(["MANTER", "REORGANIZAR", "MELHORAR", "DESCARTAR"])

export const auditResultSchema = z.object({
  existing_course_structure: z.object({
    chapters_count: z.number(),
    questions_count: z.number(),
    total_content_length: z.number(),
    has_learning_objectives: z.boolean(),
  }),
  content_analysis: z.object({
    topics: z.array(z.string()),
    concepts: z.array(z.string()),
    bloom_levels_detected: z.array(z.string()),
  }),
  quality_audit: z.object({
    overall_score: z.number().min(0).max(100),
    dimensions: z.object({
      content_quality: z.number().min(0).max(100),
      bloom_alignment: z.number().min(0).max(100),
      assessment_coverage: z.number().min(0).max(100),
      structural_coherence: z.number().min(0).max(100),
      practical_application: z.number().min(0).max(100),
    }),
  }),
  gap_report: z.object({
    gaps: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  preservation_map: z.array(
    z.object({
      element: z.string(),
      type: z.enum(["chapter", "question", "content"]),
      status: preservationStatus,
      reason: z.string(),
    }),
  ),
  improvement_plan: z.array(
    z.object({
      priority: z.enum(["high", "medium", "low"]),
      action: z.string(),
      impact: z.string(),
    }),
  ),
  enriched_input: z.object({
    course_title: z.string().optional(),
    business_goal: z.string().optional(),
    behavior_change: z.string().optional(),
    topics_outline: z.array(z.string()).optional(),
    total_duration_hours: z.number().optional(),
    experience_level: z.string().optional(),
    assessment_preference: z.string().optional(),
  }),
})

export type AuditResult = z.infer<typeof auditResultSchema>

// --- Types ---

export interface CourseForAudit {
  id: string
  title: string
  description: string | null
  chapters: Array<{
    id: string
    title: string
    content: string | null
    learningObjective: string | null
    order: number
    questions: Array<{
      text: string
      skill: string | null
      expectedDepth: string | null
    }>
  }>
}

// --- Main Function ---

export async function auditCourse(
  course: CourseForAudit,
  model: LanguageModel,
): Promise<AuditResult> {
  // Build context from course data
  const chaptersText = course.chapters
    .sort((a, b) => a.order - b.order)
    .map((ch) => {
      const questionsText = ch.questions
        .map((q) => `  - Q: ${q.text} [skill: ${q.skill || "N/A"}, depth: ${q.expectedDepth || "N/A"}]`)
        .join("\n")

      return `### Capítulo ${ch.order}: ${ch.title}
Objetivo: ${ch.learningObjective || "N/A"}
Conteúdo: ${(ch.content || "Sem conteúdo").slice(0, 3000)}
Perguntas (${ch.questions.length}):
${questionsText || "  Nenhuma pergunta"}`
    })
    .join("\n\n")

  const prompt = `Analise o seguinte curso existente e gere o relatório de auditoria completo (7 passos).

## Curso: ${course.title}
Descrição: ${course.description || "N/A"}
Total de Capítulos: ${course.chapters.length}
Total de Perguntas: ${course.chapters.reduce((sum, ch) => sum + ch.questions.length, 0)}

${chaptersText}`

  const { object } = await generateObject({
    model,
    system: AUDITOR_SYSTEM_PROMPT,
    schema: auditResultSchema,
    prompt,
    abortSignal: AbortSignal.timeout(120_000), // 2 min timeout for large courses
  })

  return object
}
