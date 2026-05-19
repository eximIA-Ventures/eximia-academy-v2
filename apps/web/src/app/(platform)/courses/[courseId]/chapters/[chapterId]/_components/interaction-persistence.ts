"use server"

import { createClient } from "@/lib/supabase/server"

// === HELPERS ===

async function resolveUserAndTenant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  const tenantId = profile?.tenant_id as string | undefined
  if (!tenantId) return null

  return { supabase, userId: user.id, tenantId }
}

// === SCENARIO ===

export async function saveScenarioAttempt(chapterId: string, data: {
  scenarioTitle: string
  status: "in_progress" | "completed"
  stepResponses: Array<{ stepId: string; response: string }>
  evaluation?: {
    overallScore: number
    stepFeedback: Record<string, unknown>[]
    strengths: string[]
    improvements: string[]
    feedback?: string
  } | null
}) {
  const ctx = await resolveUserAndTenant()
  if (!ctx) return { error: "Não autenticado" }

  const { supabase, userId, tenantId } = ctx

  const { error } = await supabase
    .from("scenario_attempts")
    .upsert({
      student_id: userId,
      chapter_id: chapterId,
      tenant_id: tenantId,
      scenario_title: data.scenarioTitle,
      status: data.status,
      overall_score: data.evaluation?.overallScore ?? null,
      step_responses: data.stepResponses,
      evaluation: data.evaluation ?? null,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
    }, { onConflict: "student_id,chapter_id" })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getScenarioAttempt(chapterId: string) {
  const ctx = await resolveUserAndTenant()
  if (!ctx) return null

  const { supabase, userId } = ctx

  const { data } = await supabase
    .from("scenario_attempts")
    .select("*")
    .eq("student_id", userId)
    .eq("chapter_id", chapterId)
    .maybeSingle()

  return data
}

// === ASSIGNMENT ===

export async function saveAssignmentSubmission(chapterId: string, data: {
  content: string
  status: "draft" | "submitted" | "evaluated"
  evaluation?: {
    criteria: Array<{ name: string; score: number; comment: string }>
    overallScore: number
    overallComment: string
    grade: string
  } | null
}) {
  const ctx = await resolveUserAndTenant()
  if (!ctx) return { error: "Não autenticado" }

  const { supabase, userId, tenantId } = ctx

  const record: Record<string, unknown> = {
    student_id: userId,
    chapter_id: chapterId,
    tenant_id: tenantId,
    content: data.content,
    status: data.status,
    updated_at: new Date().toISOString(),
  }

  if (data.status === "submitted") {
    record.submitted_at = new Date().toISOString()
  }

  if (data.evaluation) {
    record.evaluation = data.evaluation
    record.overall_score = data.evaluation.overallScore
    record.grade = data.evaluation.grade
    record.status = "evaluated"
    record.evaluated_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("assignment_submissions")
    .upsert(record, { onConflict: "student_id,chapter_id" })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getAssignmentSubmission(chapterId: string) {
  const ctx = await resolveUserAndTenant()
  if (!ctx) return null

  const { supabase, userId } = ctx

  const { data } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("student_id", userId)
    .eq("chapter_id", chapterId)
    .maybeSingle()

  return data
}
