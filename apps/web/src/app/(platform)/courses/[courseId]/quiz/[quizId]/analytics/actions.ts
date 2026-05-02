"use server"

import { createClient } from "@/lib/supabase/server"

type Period = "7d" | "30d" | "all"

interface HardestQuestion {
  questionId: string
  text: string
  errorCount: number
  totalAnswers: number
  errorRate: number
}

interface StudentRow {
  studentId: string
  studentName: string
  score: number | null
  timeMinutes: number | null
  attempts: number
  status: string
}

interface AnalyticsData {
  passRate: number | null
  passRateTrend: number | null
  avgScore: number | null
  avgTimeMinutes: number | null
  totalAttempts: number
  scoreDistribution: number[]
  hardestQuestions: HardestQuestion[]
  students: StudentRow[]
}

function getPeriodDate(period: Period): Date | null {
  if (period === "all") return null
  const now = new Date()
  const days = period === "7d" ? 7 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

export async function getQuizAnalytics(
  quizId: string,
  period: Period = "all",
): Promise<{ data?: AnalyticsData; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  // Role check — instructor/manager/admin
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["instructor", "manager", "admin"].includes(profile.role)) {
    return { error: "Acesso restrito a instrutores" }
  }

  const periodDate = getPeriodDate(period)

  // Fetch all completed attempts for this quiz
  let query = supabase
    .from("quiz_attempts")
    .select("id, student_id, score, status, feedback, started_at, completed_at, created_at")
    .eq("quiz_session_id", quizId)
    .in("status", ["passed", "failed", "timed_out", "pending_review"])

  if (periodDate) {
    query = query.gte("created_at", periodDate.toISOString())
  }

  const { data: attempts, error } = await query.order("created_at", { ascending: false })
  if (error) return { error: error.message }
  if (!attempts || attempts.length === 0) {
    return {
      data: {
        passRate: null,
        passRateTrend: null,
        avgScore: null,
        avgTimeMinutes: null,
        totalAttempts: 0,
        scoreDistribution: [0, 0, 0, 0, 0],
        hardestQuestions: [],
        students: [],
      },
    }
  }

  // Pass rate
  const scoredAttempts = attempts.filter((a) => a.status === "passed" || a.status === "failed")
  const passedCount = scoredAttempts.filter((a) => a.status === "passed").length
  const passRate = scoredAttempts.length > 0 ? (passedCount / scoredAttempts.length) * 100 : null

  // Trend: compare with previous period
  let passRateTrend: number | null = null
  if (periodDate && period !== "all") {
    const days = period === "7d" ? 7 : 30
    const prevStart = new Date(periodDate.getTime() - days * 24 * 60 * 60 * 1000)
    const { data: prevAttempts } = await supabase
      .from("quiz_attempts")
      .select("status")
      .eq("quiz_session_id", quizId)
      .in("status", ["passed", "failed"])
      .gte("created_at", prevStart.toISOString())
      .lt("created_at", periodDate.toISOString())

    if (prevAttempts && prevAttempts.length > 0) {
      const prevPassed = prevAttempts.filter((a) => a.status === "passed").length
      const prevRate = (prevPassed / prevAttempts.length) * 100
      passRateTrend = passRate !== null ? passRate - prevRate : null
    }
  }

  // Avg score
  const scores = attempts.filter((a) => a.score !== null).map((a) => Number(a.score))
  const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null

  // Avg time (minutes)
  const times = attempts
    .filter((a) => a.started_at && a.completed_at)
    .map((a) => {
      const start = new Date(a.started_at).getTime()
      const end = new Date(a.completed_at).getTime()
      return (end - start) / 1000 / 60
    })
    .filter((t) => t > 0 && t < 300) // sanity: exclude > 5h

  const avgTimeMinutes =
    times.length > 0 ? Math.round(times.reduce((s, v) => s + v, 0) / times.length) : null

  // Score distribution: [0-20, 20-40, 40-60, 60-80, 80-100]
  const scoreDistribution = [0, 0, 0, 0, 0]
  for (const s of scores) {
    const idx = Math.min(Math.floor(s / 20), 4)
    scoreDistribution[idx]++
  }

  // Hardest questions from feedback JSONB
  const errorMap = new Map<string, { errors: number; total: number }>()
  for (const attempt of attempts) {
    const feedback = attempt.feedback as
      | Array<{ questionId: string; correct: boolean | null }>
      | null
    if (!feedback) continue
    for (const item of feedback) {
      if (item.correct === null) continue // skip open_ended
      const entry = errorMap.get(item.questionId) ?? { errors: 0, total: 0 }
      entry.total++
      if (!item.correct) entry.errors++
      errorMap.set(item.questionId, entry)
    }
  }

  // Get question texts for hardest questions
  const questionIds = [...errorMap.keys()]
  let questionTextsMap = new Map<string, string>()
  if (questionIds.length > 0) {
    const { data: qs } = await supabase.from("questions").select("id, text").in("id", questionIds)
    if (qs) questionTextsMap = new Map(qs.map((q) => [q.id, q.text]))
  }

  const hardestQuestions: HardestQuestion[] = [...errorMap.entries()]
    .map(([qId, { errors, total }]) => ({
      questionId: qId,
      text: questionTextsMap.get(qId) ?? "Questao desconhecida",
      errorCount: errors,
      totalAnswers: total,
      errorRate: total > 0 ? (errors / total) * 100 : 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5)

  // Student table: aggregate per student
  const studentMap = new Map<
    string,
    { bestScore: number | null; bestStatus: string; totalAttempts: number; bestTime: number | null }
  >()
  for (const attempt of attempts) {
    const existing = studentMap.get(attempt.student_id)
    const timeMin =
      attempt.started_at && attempt.completed_at
        ? (new Date(attempt.completed_at).getTime() - new Date(attempt.started_at).getTime()) /
          1000 /
          60
        : null

    if (!existing) {
      studentMap.set(attempt.student_id, {
        bestScore: attempt.score !== null ? Number(attempt.score) : null,
        bestStatus: attempt.status,
        totalAttempts: 1,
        bestTime: timeMin,
      })
    } else {
      existing.totalAttempts++
      if (attempt.score !== null && (existing.bestScore === null || Number(attempt.score) > existing.bestScore)) {
        existing.bestScore = Number(attempt.score)
        existing.bestStatus = attempt.status
        existing.bestTime = timeMin
      }
    }
  }

  // Get student names
  const studentIds = [...studentMap.keys()]
  let studentNames = new Map<string, string>()
  if (studentIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", studentIds)
    if (users) studentNames = new Map(users.map((u) => [u.id, u.name ?? "Aluno"]))
  }

  const students: StudentRow[] = [...studentMap.entries()]
    .map(([sid, data]) => ({
      studentId: sid,
      studentName: studentNames.get(sid) ?? "Aluno",
      score: data.bestScore,
      timeMinutes: data.bestTime !== null ? Math.round(data.bestTime) : null,
      attempts: data.totalAttempts,
      status: data.bestStatus,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  return {
    data: {
      passRate,
      passRateTrend,
      avgScore,
      avgTimeMinutes,
      totalAttempts: attempts.length,
      scoreDistribution,
      hardestQuestions,
      students,
    },
  }
}
