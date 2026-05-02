"use server"

import { createClient } from "@/lib/supabase/server"
import { createQuizSessionSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

async function requireQuizRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: string; tenantId: string; error?: never } | { error: string }> {
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (!["manager", "admin", "instructor"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }
  return { role: profile.role, tenantId: profile.tenant_id }
}

export async function createQuizSession(courseId: string, raw: unknown) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireQuizRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  // FIX-26.2-001: Verify course belongs to user's tenant
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("tenant_id", roleCheck.tenantId)
    .single()
  if (!course) return { error: "Curso não encontrado" }

  const result = createQuizSessionSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { data: quiz, error } = await supabase
    .from("quiz_sessions")
    .insert({
      tenant_id: roleCheck.tenantId,
      course_id: courseId,
      chapter_id: result.data.chapter_id ?? null,
      title: result.data.title,
      quiz_type: result.data.quiz_type,
      time_limit_minutes: result.data.time_limit_minutes ?? null,
      passing_score: result.data.passing_score,
      max_attempts: result.data.max_attempts,
      shuffle_questions: result.data.shuffle_questions,
      show_answers_after: result.data.show_answers_after,
      question_ids: result.data.question_ids,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { error: "Erro ao criar quiz" }

  revalidatePath(`/courses/${courseId}`)
  return { data: quiz }
}

export async function listCourseQuizzes(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, title, quiz_type, is_active, question_ids, time_limit_minutes, passing_score, max_attempts, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })

  if (error) return { error: "Erro ao carregar quizzes", data: [] }
  return { data: data ?? [] }
}

export async function listCourseQuestions(courseId: string, chapterId?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  let query = supabase
    .from("questions")
    .select("id, text, skill, status, chapter_id")
    .eq("status", "active")

  // Filter by chapter if specified
  if (chapterId) {
    query = query.eq("chapter_id", chapterId)
  }

  // Get chapters for this course to filter questions
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)

  if (!chapters || chapters.length === 0) return { data: [] }

  const chapterIds = chapters.map((c) => c.id)
  query = query.in("chapter_id", chapterIds)

  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) return { error: "Erro ao carregar questões", data: [] }
  return { data: data ?? [] }
}

export async function listCourseChapters(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data, error } = await supabase
    .from("chapters")
    .select("id, title, order")
    .eq("course_id", courseId)
    .order("order", { ascending: true })

  if (error) return { error: "Erro ao carregar capítulos", data: [] }
  return { data: data ?? [] }
}
