import { courseDesignerCrudLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { getModelWithFallback } from "@eximia/agents"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const aiFillRequestSchema = z.object({
  step: z.number().min(1).max(6),
  filled_fields: z.record(z.string(), z.unknown()),
})

const suggestionSchema = z.object({
  suggestions: z.record(
    z.string(),
    z.object({
      value: z.unknown(),
      confidence: z.number().min(0).max(1),
      rationale: z.string(),
    }),
  ),
})

/**
 * POST /api/course-designer/ai-fill
 * Uses LLM to suggest values for empty wizard fields based on already-filled fields.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  if (courseDesignerCrudLimiter) {
    const { success } = await courseDesignerCrudLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  }

  let body: z.infer<typeof aiFillRequestSchema>
  try {
    body = aiFillRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Request body inválido" }, { status: 400 })
  }

  try {
    const model = getModelWithFallback({
      agentRole: "analyst",
      tenantPlan: "standard",
    })

    // Extract document content from context_files
    const contextFiles = body.filled_fields.context_files as
      | Array<{ name: string; type: string; content_summary?: string }>
      | undefined
    const documentContents = contextFiles
      ?.filter((f) => f.content_summary)
      .map((f) => `### ${f.name} (${f.type})\n${f.content_summary}`)
      .join("\n\n")

    const filledSummary = Object.entries(body.filled_fields)
      .filter(([k]) => k !== "context_files")
      .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
      .join("\n")

    const stepNames: Record<number, string> = {
      1: "Propósito (course_title, business_goal, behavior_change, success_metrics)",
      2: "Audiência (role, experience_level, prior_knowledge, group_size, learning_environment)",
      3: "Escopo (core_competencies, topics_outline, content_density, assessment_preference)",
      4: "Restrições (total_duration_hours, weeks, hours_per_week, delivery_mode, session_length_preference)",
      5: "Preferências (framework, interaction_strategy, dominant_interaction_type, language)",
      6: "Pré-validação e Geração",
    }

    const result = await generateObject({
      model,
      schema: suggestionSchema,
      prompt: `Você é um assistente de design instrucional. O instrutor está preenchendo o passo ${body.step} (${stepNames[body.step] ?? ""}) de um wizard de criação de curso.

Campos já preenchidos:
${filledSummary || "Nenhum campo preenchido ainda."}
${documentContents ? `\n## Conteúdo dos Documentos de Referência\nO instrutor subiu documentos cujo conteúdo foi analisado. Use estas informações para fazer sugestões mais precisas e contextualizadas:\n\n${documentContents}` : ""}

Sugira valores para os campos VAZIOS deste passo. Para cada sugestão, forneça:
- value: o valor sugerido (string, number, array conforme o tipo do campo)
- confidence: 0-1 indicando sua confiança na sugestão
- rationale: breve justificativa em português

Responda apenas com campos deste passo que ainda não foram preenchidos. Se todos já estão preenchidos, retorne suggestions vazio.`,
    })

    return NextResponse.json(result.object)
  } catch (err) {
    console.error("AI fill error:", err)
    return NextResponse.json({ error: "Erro ao gerar sugestões" }, { status: 500 })
  }
}
