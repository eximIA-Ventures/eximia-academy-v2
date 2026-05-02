"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// SECURITY-CRITICAL: Zod schema restricts to profile fields ONLY.
// This prevents role escalation via users_update_self RLS policy.
const onboardingSchema = z.object({
  profile: z.object({
    employee_status: z.enum(["new_needs_onboarding", "new_already_onboarded", "existing"]),
    photo_url: z.string().optional(),
  }),
})

export type OnboardingPayload = z.infer<typeof onboardingSchema>

async function handleAutoEnrollment(
  userId: string,
  tenantId: string,
): Promise<{ enrolled: boolean }> {
  const supabase = await createClient()

  // Find published onboarding course for this tenant
  const { data: onboardingCourse } = await supabase
    .from("courses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", "onboarding")
    .eq("status", "published")
    .single()

  if (!onboardingCourse) {
    return { enrolled: false }
  }

  // Auto-enroll (handle duplicate gracefully — error 23505)
  const { error } = await supabase.from("enrollments").insert({
    student_id: userId,
    course_id: onboardingCourse.id,
    tenant_id: tenantId,
    status: "active",
    progress: {},
  })

  if (error && error.code !== "23505") {
    console.error("Auto-enrollment failed:", error)
    return { enrolled: false }
  }

  return { enrolled: true }
}

export async function saveOnboardingProfile(payload: OnboardingPayload) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Não autenticado. Faça login novamente." }
    }

    // Validate payload with Zod — only profile fields allowed
    const parsed = onboardingSchema.safeParse(payload)
    if (!parsed.success) {
      return { error: `Dados inválidos: ${parsed.error.issues.map((i) => i.message).join(", ")}` }
    }

    // Get user's tenant_id for auto-enrollment
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single()

    if (!userData) {
      return { error: "Perfil não encontrado" }
    }

    // Update users table: profile JSONB + onboarding_completed = true
    const { error: updateError } = await supabase
      .from("users")
      .update({
        profile: parsed.data.profile,
        onboarding_completed: true,
      })
      .eq("id", user.id)

    if (updateError) {
      return { error: `Erro ao salvar perfil: ${updateError.message}` }
    }

    // Auto-enrollment logic
    let autoEnrolled = false
    let noOnboardingTrail = false

    if (parsed.data.profile.employee_status === "new_needs_onboarding") {
      const result = await handleAutoEnrollment(user.id, userData.tenant_id)
      autoEnrolled = result.enrolled
      noOnboardingTrail = !result.enrolled
    }

    revalidatePath("/dashboard")
    return { success: true, autoEnrolled, noOnboardingTrail }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return { error: `Falha no onboarding: ${message}` }
  }
}

export async function skipOnboarding() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Não autenticado. Faça login novamente." }
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        onboarding_completed: true,
      })
      .eq("id", user.id)

    if (updateError) {
      return { error: `Erro ao pular onboarding: ${updateError.message}` }
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return { error: `Falha ao pular onboarding: ${message}` }
  }
}
