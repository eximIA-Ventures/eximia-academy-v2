"use server"

import { issueCertificate } from "@/lib/certificates/generate"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
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
    .limit(1)

  const sessionRow = session?.[0] ?? null
  if (!sessionRow) throw new Error("Session not found")

  const { error } = await supabase
    .from("sessions")
    .update({ status: "abandoned" })
    .eq("id", sessionRow.id)

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
    .limit(1)
  if (!enrollment || enrollment.length === 0) throw new Error("Not enrolled")

  // 2. Check if already completed (has a completed session)
  const { data: existingCompleted } = await supabase
    .from("sessions")
    .select("id")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "completed")
    .limit(1)
  if (existingCompleted && existingCompleted.length > 0) return { success: true, alreadyCompleted: true }

  // 3. Get tenant_id
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .limit(1)
  const tenantId = (profile?.[0]?.tenant_id as string) ?? null

  // 4. Get any active question for the chapter (or null)
  const { data: questionRows } = await supabase
    .from("questions")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .limit(1)

  // 5. Create a completed session (manual completion) — service client to bypass RLS
  const service = createServiceClient()
  const { error } = await service.from("sessions").insert({
    student_id: user.id,
    chapter_id: chapterId,
    question_id: questionRows?.[0]?.id ?? null,
    tenant_id: tenantId,
    interactions_remaining: 0,
    status: "completed",
    completed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)

  // 6. Update enrollment progress via RPC
  const { data: progressResult } = await supabase.rpc("update_enrollment_progress", {
    p_student_id: user.id,
    p_course_id: courseId,
  })

  // 7. Auto-issue certificate when course is completed
  if (progressResult && progressResult.length > 0 && progressResult[0].new_status === "completed") {
    const enrollId = progressResult[0].enrollment_id as string
    issueCertificate(enrollId).catch(() => {
      // Silently handle — certificate can be issued later on demand
    })
  }

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
    .limit(1)
  if (!enrollment || enrollment.length === 0) throw new Error("Not enrolled")

  // 2. Check for existing active session — resume instead of creating
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("student_id", user.id)
    .eq("chapter_id", chapterId)
    .eq("status", "active")
    .limit(1)
  if (activeSession && activeSession.length > 0) {
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
      .limit(1)
    const chosenRow = chosenQuestion?.[0] ?? null
    if (!chosenRow) throw new Error("Invalid question")
    resolvedQuestionId = chosenRow.id
  } else {
    const { data: rpcResult } = await supabase
      .rpc("get_random_active_question", { p_chapter_id: chapterId })
    const rpcRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
    if (!rpcRow?.id) throw new Error("No active questions available")
    resolvedQuestionId = rpcRow.id
  }

  // 4. Read tenant max_interactions
  const { data: profileRows } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .limit(1)
  const tenantId = profileRows?.[0]?.tenant_id ?? null

  let maxInteractions = 6
  if (tenantId) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .limit(1)
    maxInteractions =
      ((tenantRows?.[0]?.settings as Record<string, unknown>)?.max_interactions_per_session as number) ?? 6
  }

  // 5. Create session — use service client to bypass RLS
  const service = createServiceClient()
  const { data: insertedRows, error } = await service.from("sessions").insert({
    student_id: user.id,
    chapter_id: chapterId,
    question_id: resolvedQuestionId,
    tenant_id: tenantId,
    interactions_remaining: maxInteractions,
  }).select("id").limit(1)

  if (error) {
    console.error("[createSession] INSERT error:", error.message, error.code, error.details)
    throw new Error(`Falha ao criar sessão: ${error.message}`)
  }

  const newSessionId = insertedRows?.[0]?.id
  if (!newSessionId) {
    console.error("[createSession] INSERT returned no rows — silent RLS rejection or constraint violation")
    throw new Error("Falha ao criar sessão: nenhuma linha criada")
  }

  console.log("[createSession] SUCCESS — session:", newSessionId, "student:", user.id, "chapter:", chapterId)
  return redirect(`/courses/${courseId}/chapters/${chapterId}/session`)
}
