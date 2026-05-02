"use server"

import { scoreEnneagram } from "@/components/profile/scoring"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ENNEAGRAM_COOLDOWN_DAYS = 30

/**
 * Zod schema for Enneagram ranking.
 * Expects exactly 9 unique numbers representing types 1-9 in ranked order.
 */
const enneagramRankingSchema = z
  .array(z.number().int().min(1).max(9))
  .length(9)
  .refine(
    (val) => new Set(val).size === 9,
    { message: "O ranking deve conter todos os 9 tipos sem repetição" },
  )

/**
 * Submit a completed Enneagram assessment.
 * Validates 9-item ranking, scores it, determines type and wing,
 * saves to user profile and assessment_history.
 */
export async function submitEnneagramAssessment(
  ranking: number[],
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const parsed = enneagramRankingSchema.safeParse(ranking)
  if (!parsed.success) {
    return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }
  }

  // Score using existing scoring function
  const result = scoreEnneagram(ranking)

  const resultPayload = {
    type: result.type,
    wing: result.wing,
    scores: result.scores,
  }

  // Save to user profile via atomic JSONB merge
  const { error: profileError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "enneagram",
    p_set_value: JSON.stringify(resultPayload),
    p_remove_key: "enneagram_progress",
  })
  if (profileError) {
    console.error("Failed to save Enneagram profile:", profileError.message)
    return { error: "Erro ao salvar resultado no perfil" }
  }

  // Insert into assessment_history for evolution tracking
  const { data: userTenant } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()

  if (userTenant?.tenant_id) {
    const { error: historyError } = await supabase.from("assessment_history").insert({
      user_id: user.id,
      tenant_id: userTenant.tenant_id,
      assessment_type: "enneagram",
      result: resultPayload as Record<string, unknown>,
    })
    if (historyError) {
      console.error("Failed to insert Enneagram assessment history:", historyError.message)
    }
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/enneagram")
  return { success: true }
}

/**
 * Get the date of the last completed Enneagram assessment for cooldown check.
 * Returns null if no previous assessment exists.
 */
export async function getLastEnneagramDate(): Promise<{ date: string | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { date: null, error: "Não autenticado" }

  const { data, error } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "enneagram")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch last Enneagram date:", error.message)
    return { date: null, error: "Erro ao verificar histórico" }
  }

  return { date: data?.completed_at ?? null }
}

/**
 * Get the latest Enneagram result for the authenticated user.
 * Returns null if the user has not completed the Enneagram.
 */
export async function getEnneagramResult(): Promise<{
  result: {
    type: number
    wing?: number
    scores: number[]
  } | null
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { result: null, error: "Não autenticado" }

  const { data, error } = await supabase
    .from("assessment_history")
    .select("result")
    .eq("user_id", user.id)
    .eq("assessment_type", "enneagram")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch Enneagram result:", error.message)
    return { result: null, error: "Erro ao carregar resultado" }
  }

  if (!data?.result) return { result: null }

  const r = data.result as Record<string, unknown>
  return {
    result: {
      type: (r.type as number) ?? 1,
      wing: r.wing as number | undefined,
      scores: (r.scores as number[]) ?? [],
    },
  }
}

/**
 * Check if the authenticated user is within the cooldown period.
 * Returns true if the user must wait, along with remaining days.
 */
export async function checkEnneagramCooldown(): Promise<{
  onCooldown: boolean
  remainingDays: number
  lastDate: string | null
}> {
  const { date } = await getLastEnneagramDate()

  if (!date) {
    return { onCooldown: false, remainingDays: 0, lastDate: null }
  }

  const lastCompleted = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - lastCompleted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const remaining = Math.max(0, ENNEAGRAM_COOLDOWN_DAYS - diffDays)

  return {
    onCooldown: diffDays < ENNEAGRAM_COOLDOWN_DAYS,
    remainingDays: remaining,
    lastDate: date,
  }
}
