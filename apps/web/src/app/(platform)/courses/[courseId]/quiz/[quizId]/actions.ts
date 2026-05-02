"use server"

import { scoreAndUpdateAttempt } from "@/lib/quiz/scoring"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getQuizSession(quizId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select(
      "id, title, quiz_type, time_limit_minutes, passing_score, max_attempts, shuffle_questions, show_answers_after, question_ids, is_active, course_id",
    )
    .eq("id", quizId)
    .single()

  if (error || !data) return { error: "Quiz não encontrado" }
  return { data }
}

export async function getStudentAttempts(quizId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], count: 0 }

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id, status, score, total_questions, correct_answers, feedback, started_at, completed_at")
    .eq("quiz_session_id", quizId)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { data: [], count: 0 }
  return { data: data ?? [], count: data?.length ?? 0 }
}

export async function getQuizQuestions(questionIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  if (questionIds.length === 0) return { data: [] }

  const { data, error } = await supabase
    .from("questions")
    .select("id, text, skill, question_type, options")
    .in("id", questionIds)

  if (error) return { error: error.message, data: [] }

  // Return in the same order as question_ids (never expose correct_answer)
  const ordered = questionIds
    .map((id) => data?.find((q) => q.id === id))
    .filter(Boolean) as {
    id: string
    text: string
    skill: string | null
    question_type: string
    options: string[] | null
  }[]

  return { data: ordered }
}

export async function startQuizAttempt(quizId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  // Get quiz session
  const { data: quiz } = await supabase
    .from("quiz_sessions")
    .select("id, max_attempts, question_ids, course_id, tenant_id")
    .eq("id", quizId)
    .single()

  if (!quiz) return { error: "Quiz não encontrado" }

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", quiz.course_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (!enrollment) return { error: "Você nao esta inscrito neste curso" }

  // Check max attempts
  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("quiz_session_id", quizId)
    .eq("student_id", user.id)

  if (count !== null && quiz.max_attempts && count >= quiz.max_attempts) {
    return { error: "Limite de tentativas atingido" }
  }

  // Create attempt
  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_session_id: quizId,
      student_id: user.id,
      tenant_id: quiz.tenant_id,
      total_questions: quiz.question_ids?.length ?? 0,
      status: "in_progress",
    })
    .select("id, started_at")
    .single()

  if (error) return { error: error.message }
  return { data: attempt }
}

export async function submitQuizAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; answer: string }>,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  // Get the attempt
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_session_id, student_id, started_at, status")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single()

  if (!attempt) return { error: "Tentativa não encontrada" }
  if (attempt.status !== "in_progress") return { error: "Tentativa já finalizada" }

  // Get quiz session for time limit check
  const { data: quiz } = await supabase
    .from("quiz_sessions")
    .select("time_limit_minutes, course_id")
    .eq("id", attempt.quiz_session_id)
    .single()

  // Determine status
  let status: "completed" | "timed_out" = "completed"
  if (quiz?.time_limit_minutes) {
    const startedAt = new Date(attempt.started_at).getTime()
    const timeLimit = quiz.time_limit_minutes * 60 * 1000
    if (Date.now() > startedAt + timeLimit) {
      status = "timed_out"
    }
  }

  // Update attempt with answers and timestamp
  const { error } = await supabase
    .from("quiz_attempts")
    .update({
      answers,
      status,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("student_id", user.id)

  if (error) return { error: error.message }

  // Run auto-scoring (updates score, correct_answers, feedback, and final status)
  try {
    const scoringResult = await scoreAndUpdateAttempt(attemptId)
    // Use scoring status unless timed_out (preserve timeout status)
    const finalStatus = status === "timed_out" ? "timed_out" : scoringResult.status
    if (finalStatus !== scoringResult.status) {
      await supabase
        .from("quiz_attempts")
        .update({ status: finalStatus })
        .eq("id", attemptId)
    }
    status = finalStatus as "completed" | "timed_out"
  } catch (scoringError) {
    console.error(`[quiz] Scoring failed for attempt ${attemptId}:`, scoringError)
    // Mark as needing manual review since scoring failed
    await supabase
      .from("quiz_attempts")
      .update({ status: "pending_review" })
      .eq("id", attemptId)
    return { data: { status: "pending_review" as const, attemptId } }
  }

  if (quiz?.course_id) {
    revalidatePath(`/courses/${quiz.course_id}`)
  }

  return { data: { status, attemptId } }
}

export async function getRemediationChapters(
  questionIds: string[],
  feedback: Array<{ questionId: string; correct: boolean | null }>,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  // Get question IDs that were answered incorrectly
  const incorrectIds = feedback
    .filter((f) => f.correct === false)
    .map((f) => f.questionId)

  if (incorrectIds.length === 0) return { data: [] }

  // Fetch chapter_id for incorrect questions
  const { data: questions } = await supabase
    .from("questions")
    .select("id, chapter_id")
    .in("id", incorrectIds)

  if (!questions) return { data: [] }

  // Group by chapter
  const chapterErrors = new Map<string, number>()
  for (const q of questions) {
    if (!q.chapter_id) continue
    chapterErrors.set(q.chapter_id, (chapterErrors.get(q.chapter_id) ?? 0) + 1)
  }

  if (chapterErrors.size === 0) return { data: [] }

  // Fetch chapter titles
  const chapterIds = [...chapterErrors.keys()]
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title")
    .in("id", chapterIds)

  if (!chapters) return { data: [] }

  const result = chapters
    .map((ch) => ({
      chapterId: ch.id,
      chapterTitle: ch.title,
      errorCount: chapterErrors.get(ch.id) ?? 0,
    }))
    .sort((a, b) => b.errorCount - a.errorCount)

  return { data: result }
}
