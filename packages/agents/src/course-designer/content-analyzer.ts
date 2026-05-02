import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const topicExtractedSchema = z.object({
  title: z.string(),
  description: z.string(),
  bloom_estimate: z.enum([
    "remembering",
    "understanding",
    "applying",
    "analyzing",
    "evaluating",
    "creating",
  ]),
})

export const contentAnalysisResultSchema = z.object({
  topics_extracted: z.array(topicExtractedSchema),
  competencies_suggested: z.array(z.string()),
  structure_detected: z.array(
    z.object({
      title: z.string(),
      level: z.enum(["chapter", "section", "subsection"]),
      page_range: z.string().optional(),
    }),
  ),
  content_summary: z.string(),
  confidence: z.number().min(0).max(1),
})

export type ContentAnalysisResult = z.infer<typeof contentAnalysisResultSchema>
export type TopicExtracted = z.infer<typeof topicExtractedSchema>

// ---------------------------------------------------------------------------
// Content Analyzer Agent — LLM-only (D15)
// ---------------------------------------------------------------------------

/**
 * Analyzes document content (text extracted from PDF/PPTX/DOCX/TXT) using LLM.
 * Extracts: topics, competencies, structure, summary.
 *
 * @param textContent - Pre-extracted text from the document
 * @param fileName - Original file name for context
 * @param model - LanguageModel instance
 * @returns ContentAnalysisResult - Zod-validated analysis
 */
export async function analyzeContent(
  textContent: string,
  fileName: string,
  model: LanguageModel,
): Promise<ContentAnalysisResult> {
  // Truncate very large documents to ~50k chars for LLM context window
  const maxChars = 50_000
  const truncated =
    textContent.length > maxChars
      ? `${textContent.slice(0, maxChars)}\n\n[... documento truncado em ${maxChars} caracteres ...]`
      : textContent

  const result = await generateObject({
    model,
    schema: contentAnalysisResultSchema,
    prompt: buildContentAnalyzerPrompt(truncated, fileName),
  })

  return result.object
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildContentAnalyzerPrompt(textContent: string, fileName: string): string {
  return `Você e um analista de conteúdo educacional especializado em design instrucional.

Analise o seguinte documento e extraia informações relevantes para a criacao de um curso.

## Documento
**Arquivo:** ${fileName}

---
${textContent}
---

## Instrucoes

### 1. Topicos Extraidos
Para cada topico principal identificado no documento:
- **title**: nome curto do topico
- **description**: descrição de 1-2 frases do conteúdo
- **bloom_estimate**: nivel Bloom estimado do conteúdo (remembering, understanding, applying, analyzing, evaluating, creating)

### 2. Competencias Sugeridas
Liste competencias (habilidades observaveis) que um aluno poderia desenvolver com este conteúdo.
Formato: verbos de acao + objeto (ex: "Analisar demonstracoes financeiras trimestrais").

### 3. Estrutura Detectada
Identifique a estrutura hierarquica do documento (capítulos, secoes, subsecoes).

### 4. Resumo do Conteúdo
Escreva um resumo de 200-500 palavras sobre o conteúdo, focando em:
- Tema central
- Publico-alvo aparente
- Nivel de complexidade
- Aplicabilidade pratica

### 5. Confianca
Atribua um score de 0 a 1 indicando sua confianca na analise:
- 0.9+: documento bem estruturado, conteúdo claro
- 0.7-0.9: conteúdo compreensivel mas com lacunas
- 0.5-0.7: documento parcialmente compreensivel
- <0.5: conteúdo fragmentado ou de dificil interpretacao`
}
