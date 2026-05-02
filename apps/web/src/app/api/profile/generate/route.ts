import { DEFAULT_CHAT_MODEL } from "@/lib/constants/models"
import { createClient } from "@/lib/supabase/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"

const aiProfileSchema = z.object({
  summary: z.string().describe("Resumo geral do perfil do aluno em 2-3 frases"),
  strengths: z.array(z.string()).min(3).max(5).describe("Pontos fortes identificados"),
  learning_style: z.string().describe("Estilo de aprendizagem preferido baseado nos assessments"),
  collaboration_style: z.string().describe("Como o aluno colabora e trabalha em equipe"),
  growth_areas: z.array(z.string()).min(2).max(4).describe("Áreas de desenvolvimento e crescimento"),
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Load user profile
  const { data: userData } = await supabase
    .from("users")
    .select("profile")
    .eq("id", user.id)
    .single()

  const profile = (userData?.profile as Record<string, unknown>) || {}

  // Check rate limit: 1 generation per day
  const aiProfile = profile.ai_profile as { generated_at?: string } | undefined
  if (aiProfile?.generated_at) {
    const lastGenerated = new Date(aiProfile.generated_at)
    const now = new Date()
    const diffMs = now.getTime() - lastGenerated.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    if (diffHours < 24) {
      return Response.json(
        { error: "Você já gerou seu perfil hoje. Tente novamente amanhã." },
        { status: 429 }
      )
    }
  }

  // Count completed assessments
  const assessmentTypes = ["big_five", "enneagram", "disc", "multiple_intelligences", "career_anchors"]
  const completedAssessments = assessmentTypes.filter((type) => profile[type])
  if (completedAssessments.length < 2) {
    return Response.json(
      { error: "Complete pelo menos 2 assessments antes de gerar seu perfil IA." },
      { status: 400 }
    )
  }

  // Build context from assessments
  const assessmentContext = completedAssessments
    .map((type) => `${type}: ${JSON.stringify(profile[type])}`)
    .join("\n")

  try {
    const { object } = await generateObject({
      model: anthropic(DEFAULT_CHAT_MODEL),
      system: `Você é um especialista em psicologia organizacional e desenvolvimento humano.
Analise os resultados dos assessments de personalidade e comportamento do aluno e gere um perfil integrado.
Responda sempre em português do Brasil.
Seja específico e prático nas suas análises, conectando os diferentes assessments entre si.`,
      prompt: `Analise os seguintes resultados de assessments e gere um perfil integrado do aluno:

${assessmentContext}

Gere um perfil que integre todas as informações disponíveis, identificando padrões entre os diferentes assessments.`,
      schema: aiProfileSchema,
    })

    const aiProfileResult = {
      ...object,
      generated_at: new Date().toISOString(),
    }

    // Atomic JSONB merge to prevent race conditions
    const { error: saveError } = await supabase.rpc("jsonb_profile_merge", {
      p_user_id: user.id,
      p_set_key: "ai_profile",
      p_set_value: JSON.stringify(aiProfileResult),
      p_remove_key: "",
    })
    if (saveError) {
      console.error("Failed to save AI profile:", saveError.message)
      return Response.json({ error: "Erro ao salvar perfil" }, { status: 500 })
    }

    const { revalidatePath } = await import("next/cache")
    revalidatePath("/perfil")

    return Response.json(aiProfileResult)
  } catch (error) {
    console.error("AI profile generation error:", error)
    return Response.json({ error: "Erro ao gerar perfil IA" }, { status: 500 })
  }
}
