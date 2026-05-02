"use server"

import { scoreCareerAnchors } from "@/components/profile/scoring"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CA_COOLDOWN_DAYS = 30
const TOTAL_CA_ITEMS = 40

/**
 * Zod schema for Career Anchors Likert responses.
 * Expects exactly 40 entries with numeric string keys mapping to 1-6.
 */
const caResponsesSchema = z.record(z.string(), z.number().int().min(1).max(6)).refine(
  (val) => {
    const keys = Object.keys(val)
    if (keys.length !== TOTAL_CA_ITEMS) return false
    for (let i = 1; i <= TOTAL_CA_ITEMS; i++) {
      if (!(String(i) in val)) return false
    }
    return true
  },
  { message: `Exatamente ${TOTAL_CA_ITEMS} respostas são necessárias` },
)

/**
 * Submit a completed Career Anchors assessment.
 * Validates 40 Likert (1-6) responses, scores them, determines anchor profile,
 * saves to user profile and assessment_history.
 */
export async function submitCareerAnchorsAssessment(
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

  const parsed = caResponsesSchema.safeParse(stringKeyed)
  if (!parsed.success) {
    return { error: `Dados inválidos: ${parsed.error.issues[0].message}` }
  }

  // Score using existing scoring function
  const result = scoreCareerAnchors(answers)

  const resultPayload = {
    technical: result.technical,
    management: result.management,
    autonomy: result.autonomy,
    security: result.security,
    entrepreneurship: result.entrepreneurship,
    service: result.service,
    challenge: result.challenge,
    lifestyle: result.lifestyle,
    top3: result.top3,
  }

  // Save to user profile via atomic JSONB merge
  const { error: profileError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "career_anchors",
    p_set_value: JSON.stringify(resultPayload),
    p_remove_key: "career_anchors_progress",
  })
  if (profileError) {
    console.error("Failed to save Career Anchors profile:", profileError.message)
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
      assessment_type: "career_anchors",
      result: resultPayload as Record<string, unknown>,
    })
    if (historyError) {
      console.error("Failed to insert Career Anchors assessment history:", historyError.message)
    }
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/career-anchors")
  return { success: true }
}

/**
 * Get the date of the last completed Career Anchors assessment for cooldown check.
 * Returns null if no previous assessment exists.
 */
export async function getLastCareerAnchorsDate(): Promise<{ date: string | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { date: null, error: "Não autenticado" }

  const { data, error } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "career_anchors")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch last Career Anchors date:", error.message)
    return { date: null, error: "Erro ao verificar histórico" }
  }

  return { date: data?.completed_at ?? null }
}

/**
 * Get the latest Career Anchors result for the authenticated user.
 * Returns null if the user has not completed the assessment.
 */
export async function getCareerAnchorsResult(): Promise<{
  result: {
    technical: number
    management: number
    autonomy: number
    security: number
    entrepreneurship: number
    service: number
    challenge: number
    lifestyle: number
    top3: string[]
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
    .eq("assessment_type", "career_anchors")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch Career Anchors result:", error.message)
    return { result: null, error: "Erro ao carregar resultado" }
  }

  if (!data?.result) return { result: null }

  const r = data.result as Record<string, unknown>
  return {
    result: {
      technical: (r.technical as number) ?? 0,
      management: (r.management as number) ?? 0,
      autonomy: (r.autonomy as number) ?? 0,
      security: (r.security as number) ?? 0,
      entrepreneurship: (r.entrepreneurship as number) ?? 0,
      service: (r.service as number) ?? 0,
      challenge: (r.challenge as number) ?? 0,
      lifestyle: (r.lifestyle as number) ?? 0,
      top3: (r.top3 as string[]) ?? [],
    },
  }
}

/**
 * Check if the authenticated user is within the cooldown period.
 * Returns true if the user must wait, along with remaining days.
 */
export async function checkCareerAnchorsCooldown(): Promise<{
  onCooldown: boolean
  remainingDays: number
  lastDate: string | null
}> {
  const { date } = await getLastCareerAnchorsDate()

  if (!date) {
    return { onCooldown: false, remainingDays: 0, lastDate: null }
  }

  const lastCompleted = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - lastCompleted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const remaining = Math.max(0, CA_COOLDOWN_DAYS - diffDays)

  return {
    onCooldown: diffDays < CA_COOLDOWN_DAYS,
    remainingDays: remaining,
    lastDate: date,
  }
}
