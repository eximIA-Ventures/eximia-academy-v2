"use server"

import { type KolbResult, scoreKolb } from "@/lib/assessments/kolb-scoring"
import type { KolbMode } from "@/lib/assessments/kolb-items"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const COOLDOWN_DAYS = 30
const TOTAL_ITEMS = 12

export async function submitKolbAssessment(
  answers: Record<number, Record<KolbMode, number>>,
): Promise<{ success?: boolean; result?: KolbResult; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Validate: 12 items, each with 4 modes ranked 1-4
  const keys = Object.keys(answers)
  if (keys.length !== TOTAL_ITEMS) return { error: `Exatamente ${TOTAL_ITEMS} respostas necessárias` }

  for (const ranks of Object.values(answers)) {
    const values = [ranks.ce, ranks.ro, ranks.ac, ranks.ae].sort()
    if (values.join(",") !== "1,2,3,4") {
      return { error: "Cada questão deve ter rankings 1-4 sem repetição" }
    }
  }

  const result = scoreKolb(answers)

  const resultPayload = {
    ce: result.ce,
    ro: result.ro,
    ac: result.ac,
    ae: result.ae,
    graspingAxis: result.graspingAxis,
    transformingAxis: result.transformingAxis,
    style: result.style,
    confidence: result.confidence,
  }

  // Save to profile
  const { error: profileError } = await supabase.rpc("jsonb_profile_merge", {
    p_user_id: user.id,
    p_set_key: "kolb",
    p_set_value: JSON.stringify(resultPayload),
    p_remove_key: "kolb_progress",
  })
  if (profileError) {
    console.error("Failed to save Kolb profile:", profileError.message)
    return { error: "Erro ao salvar resultado" }
  }

  // Save to assessment_history
  const { data: userTenant } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()

  if (userTenant?.tenant_id) {
    await supabase.from("assessment_history").insert({
      user_id: user.id,
      tenant_id: userTenant.tenant_id,
      assessment_type: "kolb",
      result: resultPayload as Record<string, unknown>,
    })
  }

  revalidatePath("/perfil")
  revalidatePath("/assessments/kolb")
  revalidatePath("/profile/learning")
  return { success: true, result }
}

export async function checkKolbCooldown(): Promise<{
  onCooldown: boolean
  remainingDays: number
  lastDate: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { onCooldown: false, remainingDays: 0, lastDate: null }

  const { data } = await supabase
    .from("assessment_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("assessment_type", "kolb")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.completed_at) return { onCooldown: false, remainingDays: 0, lastDate: null }

  const diffDays = Math.floor((Date.now() - new Date(data.completed_at).getTime()) / 86400000)
  const remaining = Math.max(0, COOLDOWN_DAYS - diffDays)

  return {
    onCooldown: diffDays < COOLDOWN_DAYS,
    remainingDays: remaining,
    lastDate: data.completed_at,
  }
}

export async function getKolbResult(): Promise<{ result: KolbResult | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { result: null }

  const { data } = await supabase
    .from("assessment_history")
    .select("result")
    .eq("user_id", user.id)
    .eq("assessment_type", "kolb")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.result) return { result: null }

  const r = data.result as Record<string, unknown>
  return {
    result: {
      ce: (r.ce as number) ?? 0,
      ro: (r.ro as number) ?? 0,
      ac: (r.ac as number) ?? 0,
      ae: (r.ae as number) ?? 0,
      graspingAxis: (r.graspingAxis as number) ?? 0,
      transformingAxis: (r.transformingAxis as number) ?? 0,
      style: (r.style as KolbResult["style"]) ?? "Divergente",
      description: "",
      confidence: (r.confidence as number) ?? 0,
    },
  }
}
