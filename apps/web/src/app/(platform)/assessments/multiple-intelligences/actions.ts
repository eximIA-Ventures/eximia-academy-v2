"use server"

import { scoreMultipleIntelligences } from "@/components/profile/scoring"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const MI_COOLDOWN_DAYS = 30
const TOTAL_MI_ITEMS = 40

/**
 * Zod schema for Multiple Intelligences Likert responses.
 * Expects exactly 40 entries with numeric string keys mapping to 1-5.
 */
const miResponsesSchema = z.record(z.string(), z.number().int().min(1).max(5)).refine(
  (val) => {
    const keys = Object.keys(val)
    if (keys.length !== TOTAL_MI_ITEMS) return false
    for (let i = 1; i <= TOTAL_MI_ITEMS; i++) {
      if (!(String(i) in val)) return false
    }
    return true
  },
  { message: `Exatamente ${TOTAL_MI_ITEMS} respostas são necessárias` },
)

/**
 * Submit a completed Multiple Intelligences assessment.
 * Validates 40 Likert (1-5) responses, scores them, determines intelligence profile,
 * saves to user profile and assessment_history.
 */
export async function submitMIAssessment(
  answers: Record<number, number>,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Convert numeric keys to string keys for Zod validation
  const stringKeyed: Record<string, number> = {}
  for (const [key, val] of Object.entries(answers)) {
    stringKeyed[String(key)] = val
  }

  const parsed = miResponsesSchema.safeParse(stringKeyed)
  if (!parsed.success) {
    return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }
  }

  // Score using existing scoring function
  const result = scoreMultipleIntelligences(answers)

  const resultPayload = {
    linguistic: result.linguistic,
    logical: result.logical,
    spatial: result.spatial,
    musical: result.musical,
    kinesthetic: result.kinesthetic,
    interpersonal: result.interpersonal,
    intrapersonal: result.intrapersonal,
    naturalist: result.naturalist,
  }

  // Save to user profile via atomic JSONB merge
  const { error: profileError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "multiple_intelligences",
    p_set_value: JSON.stringify(resultPayload),
    p_remove_key: "multiple_intelligences_progress",
  })
  if (profileError) {
    console.error("Failed to save MI profile:", profileError.message)
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
      assessment_type: "multiple_intelligences",
      result: resultPayload as Record<string, unknown>,
    })
    if (historyError) {
      console.error("Failed to insert MI assessment history:", historyError.message)
    }
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/multiple-intelligences")
  return { success: true }
}

/**
 * Get the date of the last completed MI assessment for cooldown check.
 * Returns null if no previous assessment exists.
 */
export async function getLastMIDate(): Promise<{ date: string | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { date: null, error: "Não autenticado" }

  const { data, error } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "multiple_intelligences")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch last MI date:", error.message)
    return { date: null, error: "Erro ao verificar histórico" }
  }

  return { date: data?.completed_at ?? null }
}

/**
 * Get the latest MI result for the authenticated user.
 * Returns null if the user has not completed the MI assessment.
 */
export async function getMIResult(): Promise<{
  result: {
    linguistic: number
    logical: number
    spatial: number
    musical: number
    kinesthetic: number
    interpersonal: number
    intrapersonal: number
    naturalist: number
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
    .eq("assessment_type", "multiple_intelligences")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch MI result:", error.message)
    return { result: null, error: "Erro ao carregar resultado" }
  }

  if (!data?.result) return { result: null }

  const r = data.result as Record<string, unknown>
  return {
    result: {
      linguistic: (r.linguistic as number) ?? 0,
      logical: (r.logical as number) ?? 0,
      spatial: (r.spatial as number) ?? 0,
      musical: (r.musical as number) ?? 0,
      kinesthetic: (r.kinesthetic as number) ?? 0,
      interpersonal: (r.interpersonal as number) ?? 0,
      intrapersonal: (r.intrapersonal as number) ?? 0,
      naturalist: (r.naturalist as number) ?? 0,
    },
  }
}

/**
 * Check if the authenticated user is within the cooldown period.
 * Returns true if the user must wait, along with remaining days.
 */
export async function checkMICooldown(): Promise<{
  onCooldown: boolean
  remainingDays: number
  lastDate: string | null
}> {
  const { date } = await getLastMIDate()

  if (!date) {
    return { onCooldown: false, remainingDays: 0, lastDate: null }
  }

  const lastCompleted = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - lastCompleted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const remaining = Math.max(0, MI_COOLDOWN_DAYS - diffDays)

  return {
    onCooldown: diffDays < MI_COOLDOWN_DAYS,
    remainingDays: remaining,
    lastDate: date,
  }
}
