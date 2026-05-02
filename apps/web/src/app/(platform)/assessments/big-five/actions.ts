"use server"

import { scoreBigFive44 } from "@/lib/assessments/big-five-scoring"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const responsesSchema = z
  .array(z.number().int().min(1).max(5))
  .length(44, "Sao necessarias exatamente 44 respostas")

/**
 * Submit the completed Big Five assessment.
 * Validates, scores, and persists to assessment_history + user profile.
 */
export async function submitBigFiveAssessment(responses: number[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Não autenticado" }
  }

  // Check 30-day cooldown server-side
  const { data: lastAssessment } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "big_five")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  if (lastAssessment?.completed_at) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastAssessment.completed_at).getTime()) / (1000 * 60 * 60 * 24),
    )
    if (daysSince < 30) {
      return { error: `Aguarde ${30 - daysSince} dias para refazer o assessment` }
    }
  }

  const parsed = responsesSchema.safeParse(responses)
  if (!parsed.success) {
    return { error: `Dados inválidos: ${parsed.error.issues[0]?.message}` }
  }

  // Convert array to Record<number, number> keyed by item id (1-based)
  const answersMap: Record<number, number> = {}
  for (let i = 0; i < parsed.data.length; i++) {
    answersMap[i + 1] = parsed.data[i]
  }

  const scores = scoreBigFive44(answersMap)

  // Fetch tenant_id
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()

  if (!userData?.tenant_id) {
    return { error: "Tenant não encontrado" }
  }

  // Insert into assessment_history
  const { error: historyError } = await supabase.from("assessment_history").insert({
    user_id: user.id,
    tenant_id: userData.tenant_id,
    assessment_type: "big_five",
    result: scores as unknown as Record<string, unknown>,
  })

  if (historyError) {
    console.error("Failed to insert big_five assessment:", historyError.message)
    return { error: "Erro ao salvar resultado" }
  }

  // Also merge into user profile JSONB for quick access
  const { error: mergeError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "big_five",
    p_set_value: JSON.stringify(scores),
    p_remove_key: "big_five_progress",
  })

  if (mergeError) {
    console.error("Failed to merge big_five into profile:", mergeError.message)
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/big-five")

  return { success: true, scores }
}

/**
 * Get the date of the user's last completed Big Five assessment.
 * Returns null if never completed.
 */
export async function getLastBigFiveDate(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    return null
  }

  const { data } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("assessment_type", "big_five")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  return data?.completed_at ?? null
}

/**
 * Get the latest Big Five result for a given user.
 */
export async function getBigFiveResult(userId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    return null
  }

  const { data } = await supabase
    .from("assessment_history")
    .select("result, completed_at")
    .eq("user_id", userId)
    .eq("assessment_type", "big_five")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  return data ?? null
}
