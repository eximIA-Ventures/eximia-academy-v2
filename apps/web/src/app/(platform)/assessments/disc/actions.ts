"use server"

import { scoreDISC } from "@/components/profile/scoring"
import { getDominantType } from "@/lib/assessments/disc-type-labels"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const DISC_COOLDOWN_DAYS = 30
const TOTAL_DISC_ITEMS = 28

/**
 * Zod schema for DISC forced-choice responses.
 * Expects exactly 28 entries with numeric string keys mapping to "a" or "b".
 */
const discResponsesSchema = z.record(z.string(), z.enum(["a", "b"])).refine(
  (val) => {
    const keys = Object.keys(val)
    if (keys.length !== TOTAL_DISC_ITEMS) return false
    for (let i = 1; i <= TOTAL_DISC_ITEMS; i++) {
      if (!(String(i) in val)) return false
    }
    return true
  },
  { message: `Exatamente ${TOTAL_DISC_ITEMS} respostas são necessárias` },
)

/**
 * Submit a completed DISC assessment.
 * Validates 28 forced-choice responses, scores them, determines dominant type,
 * saves to user profile and assessment_history.
 */
export async function submitDiscAssessment(
  responses: Record<number, "a" | "b">,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Convert numeric keys to string keys for Zod validation
  const stringKeyed: Record<string, "a" | "b"> = {}
  for (const [key, val] of Object.entries(responses)) {
    stringKeyed[String(key)] = val
  }

  const parsed = discResponsesSchema.safeParse(stringKeyed)
  if (!parsed.success) {
    return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }
  }

  // Score using existing scoring function
  const scores = scoreDISC(responses)
  const typeInfo = getDominantType(scores)

  const resultPayload = {
    d: scores.d,
    i: scores.i,
    s: scores.s,
    c: scores.c,
    dominantType: typeInfo.dominant,
    secondaryType: typeInfo.secondary,
    typeLabel: typeInfo.label,
  }

  // Save to user profile via atomic JSONB merge
  const { error: profileError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "disc",
    p_set_value: JSON.stringify(resultPayload),
    p_remove_key: "disc_progress",
  })
  if (profileError) {
    console.error("Failed to save DISC profile:", profileError.message)
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
      assessment_type: "disc",
      result: resultPayload as Record<string, unknown>,
    })
    if (historyError) {
      console.error("Failed to insert DISC assessment history:", historyError.message)
    }
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/disc")
  return { success: true }
}

/**
 * Get the date of the last completed DISC assessment for cooldown check.
 * Returns null if no previous assessment exists.
 */
export async function getLastDiscDate(): Promise<{ date: string | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { date: null, error: "Não autenticado" }

  const { data, error } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "disc")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch last DISC date:", error.message)
    return { date: null, error: "Erro ao verificar histórico" }
  }

  return { date: data?.completed_at ?? null }
}

/**
 * Get the latest DISC result for the authenticated user.
 * Returns null if the user has not completed DISC.
 */
export async function getDiscResult(): Promise<{
  result: {
    d: number
    i: number
    s: number
    c: number
    dominantType: string
    secondaryType: string
    typeLabel: string
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
    .eq("assessment_type", "disc")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch DISC result:", error.message)
    return { result: null, error: "Erro ao carregar resultado" }
  }

  if (!data?.result) return { result: null }

  const r = data.result as Record<string, unknown>
  return {
    result: {
      d: (r.d as number) ?? 0,
      i: (r.i as number) ?? 0,
      s: (r.s as number) ?? 0,
      c: (r.c as number) ?? 0,
      dominantType: (r.dominantType as string) ?? "D",
      secondaryType: (r.secondaryType as string) ?? "I",
      typeLabel: (r.typeLabel as string) ?? "",
    },
  }
}

/**
 * Check if the authenticated user is within the cooldown period.
 * Returns true if the user must wait, along with remaining days.
 */
export async function checkDiscCooldown(): Promise<{
  onCooldown: boolean
  remainingDays: number
  lastDate: string | null
}> {
  const { date } = await getLastDiscDate()

  if (!date) {
    return { onCooldown: false, remainingDays: 0, lastDate: null }
  }

  const lastCompleted = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - lastCompleted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const remaining = Math.max(0, DISC_COOLDOWN_DAYS - diffDays)

  return {
    onCooldown: diffDays < DISC_COOLDOWN_DAYS,
    remainingDays: remaining,
    lastDate: date,
  }
}
