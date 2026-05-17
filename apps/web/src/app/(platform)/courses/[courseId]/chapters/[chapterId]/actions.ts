"use server"

import { createClient } from "@/lib/supabase/server"
import type { LearningMode } from "@eximia/shared"
import { redirect } from "next/navigation"

const VALID_MODES: LearningMode[] = ["read", "listen", "watch", "slide"]

export async function updateLearningMode(mode: LearningMode) {
  if (!VALID_MODES.includes(mode)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  await supabase.from("users").update({ learning_mode: mode }).eq("id", user.id)
}

export async function getActiveQuestions(chapterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: questions } = await supabase
    .from("questions")
    .select("id, text, skill, intention")
    .eq("chapter_id", chapterId)
    .eq("status", "active")

  return questions ?? []
}

export async function deleteSession(sessionId: string, chapterId: string, courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // Verify the session belongs to this user and is active
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .single()

  if (!session) throw new Error("Session not found")

  const { error } = await supabase
    .from("sessions")
    .update({ status: "abandoned" })
    .eq("id", session.id)

  if (error) throw new Error(error.message)

  return redirect(`/courses/${courseId}/chapters/${chapterId}`)
}

export async function markChapterComplete(chapterId: string, courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // 1. Check enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .single()
  if (!enrollment) throw new Error("Not enrolled")

  // 2. Check if already completed (has a completed session)
  const { data: existingCompleted } = await supabase
    .from("sessions")
    .select("id")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle()
  if (existingCompleted) return { success: true, alreadyCompleted: true }

  // 3. Get tenant_id
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()
  const tenantId = profile?.tenant_id as string

  // 4. Get any active question for the chapter (or null)
  const { data: question } = await supabase
    .from("questions")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  // 5. Create a completed session (manual completion)
  const { error } = await supabase.from("sessions").insert({
    student_id: user.id,
    chapter_id: chapterId,
    question_id: question?.id ?? null,
    tenant_id: tenantId,
    interactions_remaining: 0,
    status: "completed",
    completed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)

  // 6. Update enrollment progress via RPC
  await supabase.rpc("update_enrollment_progress", {
    p_student_id: user.id,
    p_course_id: courseId,
  })

  return { success: true, alreadyCompleted: false }
}

export async function createSession(chapterId: string, courseId: string, questionId?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // 1. Check enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .single()
  if (!enrollment) throw new Error("Not enrolled")

  // 2. Check for existing active session — resume instead of creating
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .single()
  if (activeSession) {
    return redirect(`/courses/${courseId}/chapters/${chapterId}/session`)
  }

  // 3. Get question — use provided questionId or fallback to random
  let resolvedQuestionId: string

  if (questionId) {
    // Validate that the question belongs to this chapter and is active
    const { data: chosenQuestion } = await supabase
      .from("questions")
      .select("id")
      .eq("id", questionId)
      .eq("chapter_id", chapterId)
      .eq("status", "active")
      .single()
    if (!chosenQuestion) throw new Error("Invalid question")
    resolvedQuestionId = chosenQuestion.id
  } else {
    const { data: question } = (await supabase
      .rpc("get_random_active_question", { p_chapter_id: chapterId })
      .single()) as { data: { id: string } | null }
    if (!question) throw new Error("No active questions available")
    resolvedQuestionId = question.id
  }

  // 4. Read tenant max_interactions
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()
  const tenantId = profile?.tenant_id as string

  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single()

  const maxInteractions =
    ((tenant?.settings as Record<string, unknown>)?.max_interactions_per_session as number) ?? 6

  // 5. Create session
  const { error } = await supabase.from("sessions").insert({
    student_id: user.id,
    chapter_id: chapterId,
    question_id: resolvedQuestionId,
    tenant_id: tenantId,
    interactions_remaining: maxInteractions,
  })
  if (error) throw new Error(error.message)

  return redirect(`/courses/${courseId}/chapters/${chapterId}/session`)
}
