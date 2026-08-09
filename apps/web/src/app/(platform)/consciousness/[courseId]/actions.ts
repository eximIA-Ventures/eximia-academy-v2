"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function saveConsciousnessResponse(data: {
  courseId: string
  phase: "pre" | "post"
  challengeText?: string
  selfRating?: number
  learningGoal?: string
  commitment?: string
  ratingChange?: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autorizado" }

  // Get enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, tenant_id")
    .eq("student_id", user.id)
    .eq("course_id", data.courseId)
    .in("status", ["active", "completed"])
    .single()

  if (!enrollment) return { error: "Matricula nao encontrada" }

  // Check if response already exists for this phase
  const { data: existing } = await supabase
    .from("consciousness_responses")
    .select("id")
    .eq("enrollment_id", enrollment.id)
    .eq("phase", data.phase)
    .maybeSingle()

  if (existing) {
    // Update existing response
    const { error } = await supabase
      .from("consciousness_responses")
      .update({
        challenge_text: data.challengeText ?? null,
        self_rating: data.selfRating ?? null,
        learning_goal: data.learningGoal ?? null,
        commitment: data.commitment ?? null,
        rating_change: data.ratingChange ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (error) return { error: `Erro ao atualizar: ${error.message}` }
  } else {
    // Insert new response
    const { error } = await supabase.from("consciousness_responses").insert({
      enrollment_id: enrollment.id,
      student_id: user.id,
      course_id: data.courseId,
      tenant_id: enrollment.tenant_id,
      phase: data.phase,
      challenge_text: data.challengeText ?? null,
      self_rating: data.selfRating ?? null,
      learning_goal: data.learningGoal ?? null,
      commitment: data.commitment ?? null,
      rating_change: data.ratingChange ?? null,
    })

    if (error) return { error: `Erro ao salvar: ${error.message}` }
  }

  revalidatePath(`/courses/${data.courseId}`)
  return { success: true }
}
