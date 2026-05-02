"use server"

import { DEFAULT_CHAT_MODEL } from "@/lib/constants/models"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const bigFiveResultSchema = z.object({
  openness: z.number().min(1).max(5),
  conscientiousness: z.number().min(1).max(5),
  extraversion: z.number().min(1).max(5),
  agreeableness: z.number().min(1).max(5),
  neuroticism: z.number().min(1).max(5),
})

const enneagramResultSchema = z.object({
  type: z.number().min(1).max(9),
  wing: z.number().min(1).max(9).optional(),
  scores: z.array(z.number().min(0).max(9)).length(9),
})

const discResultSchema = z.object({
  d: z.number().min(0).max(100),
  i: z.number().min(0).max(100),
  s: z.number().min(0).max(100),
  c: z.number().min(0).max(100),
})

const multipleIntelligencesResultSchema = z.object({
  linguistic: z.number().min(1).max(5),
  logical: z.number().min(1).max(5),
  spatial: z.number().min(1).max(5),
  musical: z.number().min(1).max(5),
  kinesthetic: z.number().min(1).max(5),
  interpersonal: z.number().min(1).max(5),
  intrapersonal: z.number().min(1).max(5),
  naturalist: z.number().min(1).max(5),
})

const careerAnchorsResultSchema = z.object({
  technical: z.number().min(1).max(6),
  management: z.number().min(1).max(6),
  autonomy: z.number().min(1).max(6),
  security: z.number().min(1).max(6),
  entrepreneurship: z.number().min(1).max(6),
  service: z.number().min(1).max(6),
  challenge: z.number().min(1).max(6),
  lifestyle: z.number().min(1).max(6),
  top3: z.array(z.string().max(200)).length(3),
})

const assessmentResultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("big_five"), result: bigFiveResultSchema }),
  z.object({ type: z.literal("enneagram"), result: enneagramResultSchema }),
  z.object({ type: z.literal("disc"), result: discResultSchema }),
  z.object({ type: z.literal("multiple_intelligences"), result: multipleIntelligencesResultSchema }),
  z.object({ type: z.literal("career_anchors"), result: careerAnchorsResultSchema }),
])

const assessmentProgressSchema = z.object({
  type: z.enum(["big_five", "enneagram", "disc", "multiple_intelligences", "career_anchors"]),
  progress: z.object({
    answers: z.record(z.string(), z.number()),
    completed: z.literal(false),
  }),
})

export async function saveAssessmentResult(payload: z.infer<typeof assessmentResultSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const parsed = assessmentResultSchema.safeParse(payload)
  if (!parsed.success) return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }

  const fieldName = parsed.data.type
  const progressField = `${fieldName}_progress`

  // Atomic JSONB merge: set result + remove progress in one query
  const { data: userData, error } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: fieldName,
    p_set_value: JSON.stringify(parsed.data.result),
    p_remove_key: progressField,
  })
  if (error) return { error: "Erro ao salvar resultado" }

  // Insert into assessment_history for evolution tracking
  const { data: userTenant } = await supabase.from("users").select("tenant_id").eq("id", user.id).single()
  if (userTenant?.tenant_id) {
    const { error: historyError } = await supabase.from("assessment_history").insert({
      user_id: user.id,
      tenant_id: userTenant.tenant_id,
      assessment_type: parsed.data.type,
      result: parsed.data.result as Record<string, unknown>,
    })
    if (historyError) console.error("Failed to insert assessment history:", historyError.message)
  }

  revalidatePath("/perfil")
  return { success: true }
}

export async function saveAssessmentProgress(payload: z.infer<typeof assessmentProgressSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const parsed = assessmentProgressSchema.safeParse(payload)
  if (!parsed.success) return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }

  const progressField = `${parsed.data.type}_progress`

  // Atomic JSONB merge for progress
  const { error } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: progressField,
    p_set_value: JSON.stringify(parsed.data.progress),
    p_remove_key: "",
  })
  if (error) return { error: "Erro ao salvar progresso" }

  return { success: true }
}

export async function generateLearningRecommendations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: userData } = await supabase.from("users").select("profile, tenant_id").eq("id", user.id).single()
  const profile = (userData?.profile as Record<string, unknown>) || {}

  // Check if AI profile exists
  if (!profile.ai_profile) return { error: "Gere seu perfil IA primeiro" }

  // Check rate limit: 1 per day
  const recs = profile.ai_recommendations as { generated_at?: string } | undefined
  if (recs?.generated_at) {
    const lastGenerated = new Date(recs.generated_at)
    const now = new Date()
    const diffHours = (now.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60)
    if (diffHours < 24) return { error: "Recomendações já geradas hoje. Tente amanhã." }
  }

  // Load available courses for the tenant
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("tenant_id", userData?.tenant_id)
    .eq("published", true)
    .limit(20)

  const courseList = (courses ?? []).map((c: { title: string; description: string | null }) => `- ${c.title}: ${(c.description ?? "").slice(0, 500)}`).join("\n")

  // Build context
  const assessmentTypes = ["big_five", "enneagram", "disc", "multiple_intelligences", "career_anchors"]
  const assessmentContext = assessmentTypes
    .filter((type) => profile[type])
    .map((type) => `${type}: ${JSON.stringify(profile[type])}`)
    .join("\n")

  const aiProfile = profile.ai_profile as Record<string, unknown>

  try {
    // Dynamic import to avoid pulling AI deps into all server actions
    const { anthropic } = await import("@ai-sdk/anthropic")
    const { generateObject } = await import("ai")
    const { z } = await import("zod")

    const recommendationsSchema = z.object({
      recommended_courses: z.array(z.object({
        course_title: z.string(),
        reason: z.string(),
      })).max(5),
      study_strategies: z.array(z.string()).min(3).max(5),
      preferred_content_format: z.string(),
    })

    const { object } = await generateObject({
      model: anthropic(DEFAULT_CHAT_MODEL),
      system: `Você é um especialista em aprendizagem personalizada. Analise o perfil do aluno e recomende cursos e estratégias de estudo. Responda em português do Brasil.`,
      prompt: `Perfil IA do aluno:
${JSON.stringify(aiProfile, null, 2)}

Resultados dos assessments:
${assessmentContext}

Cursos disponíveis:
${courseList || "Nenhum curso cadastrado ainda."}

Com base no perfil e nos assessments, recomende cursos, estratégias de estudo e formato preferido de conteúdo.`,
      schema: recommendationsSchema,
    })

    const recommendationsResult = {
      ...object,
      generated_at: new Date().toISOString(),
    }

    // Atomic JSONB merge for recommendations
    const { error } = await supabase.rpc("jsonb_profile_merge", {
      p_user_id: user.id,
      p_set_key: "ai_recommendations",
      p_set_value: JSON.stringify(recommendationsResult),
      p_remove_key: "",
    })
    if (error) return { error: "Erro ao salvar recomendações" }

    revalidatePath("/perfil")
    return { success: true, data: recommendationsResult }
  } catch (error) {
    console.error("Recommendations generation error:", error)
    return { error: "Erro ao gerar recomendações" }
  }
}
