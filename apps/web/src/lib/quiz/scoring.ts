import { createClient } from "@/lib/supabase/server"

export interface StudentAnswer {
  questionId: string
  answer: string
}

export interface QuestionRow {
  id: string
  question_type: string
  correct_answer: string | null
  explanation: string | null
}

export interface FeedbackItem {
  questionId: string
  correct: boolean | null
  studentAnswer: string
  correctAnswer: string | null
  explanation: string | null
}

export interface ScoringResult {
  score: number | null
  correctCount: number
  totalScoreable: number
  feedback: FeedbackItem[]
  status: "passed" | "failed" | "pending_review"
}

/**
 * Pure scoring logic — no DB calls, fully testable.
 */
export function computeScore(
  questionIds: string[],
  questions: QuestionRow[],
  answers: StudentAnswer[],
  passingScore: number,
): ScoringResult {
  const questionMap = new Map(questions.map((q) => [q.id, q]))
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]))

  let correctCount = 0
  let openEndedCount = 0
  const feedback: FeedbackItem[] = []

  for (const qId of questionIds) {
    const question = questionMap.get(qId)
    if (!question) continue

    const studentAnswer = answerMap.get(qId) ?? ""

    if (question.question_type === "open_ended") {
      openEndedCount++
      feedback.push({
        questionId: qId,
        correct: null,
        studentAnswer,
        correctAnswer: null,
        explanation: "Aguardando revisão do instrutor",
      })
      continue
    }

    // Auto-scoreable: multiple_choice or true_false
    const isCorrect =
      studentAnswer !== "" &&
      studentAnswer.toLowerCase().trim() === (question.correct_answer ?? "").toLowerCase().trim()

    if (isCorrect) correctCount++

    feedback.push({
      questionId: qId,
      correct: isCorrect,
      studentAnswer,
      correctAnswer: question.correct_answer,
      explanation: question.explanation ?? null,
    })
  }

  const totalScoreable = questionIds.length - openEndedCount

  // All open_ended → pending_review
  if (totalScoreable === 0) {
    return { score: null, correctCount: 0, totalScoreable: 0, feedback, status: "pending_review" }
  }

  const score = (correctCount / totalScoreable) * 100
  const status = score >= passingScore ? "passed" : "failed"

  return { score, correctCount, totalScoreable, feedback, status }
}

export async function scoreQuizAttempt(attemptId: string): Promise<ScoringResult> {
  const supabase = await createClient()

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_session_id, answers")
    .eq("id", attemptId)
    .single()

  if (!attempt) throw new Error("Attempt not found")

  const { data: quizSession } = await supabase
    .from("quiz_sessions")
    .select("passing_score, question_ids")
    .eq("id", attempt.quiz_session_id)
    .single()

  if (!quizSession) throw new Error("Quiz session not found")

  const questionIds: string[] = quizSession.question_ids ?? []
  const answers: StudentAnswer[] = (attempt.answers as StudentAnswer[]) ?? []

  const { data: questionsData } = await supabase
    .from("questions")
    .select("id, question_type, correct_answer, explanation")
    .in("id", questionIds)

  const questions: QuestionRow[] = (questionsData as QuestionRow[]) ?? []
  const passingScore = Number(quizSession.passing_score) || 70

  return computeScore(questionIds, questions, answers, passingScore)
}

export async function scoreAndUpdateAttempt(attemptId: string): Promise<ScoringResult> {
  const result = await scoreQuizAttempt(attemptId)
  const supabase = await createClient()

  const { error } = await supabase
    .from("quiz_attempts")
    .update({
      score: result.score,
      correct_answers: result.correctCount,
      feedback: result.feedback,
      status: result.status === "pending_review" ? "pending_review" : result.status,
    })
    .eq("id", attemptId)

  if (error) {
    console.error(`[scoring] Failed to update attempt ${attemptId}:`, error.message)
    throw new Error(`Scoring update failed: ${error.message}`)
  }

  return result
}
