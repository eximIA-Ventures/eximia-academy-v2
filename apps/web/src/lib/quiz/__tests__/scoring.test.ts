import { describe, expect, it } from "vitest"
import type { QuestionRow, StudentAnswer } from "../scoring"
import { computeScore } from "../scoring"

/* ----------------------------- Helpers ----------------------------- */

function makeQuestion(
  id: string,
  type: "multiple_choice" | "true_false" | "open_ended",
  correctAnswer: string | null = null,
  explanation: string | null = null,
): QuestionRow {
  return { id, question_type: type, correct_answer: correctAnswer, explanation }
}

function makeAnswer(questionId: string, answer: string): StudentAnswer {
  return { questionId, answer }
}

/* ----------------------------- Tests ------------------------------ */

describe("Quiz Scoring — computeScore (Story 26.7)", () => {
  describe("Multiple Choice scoring", () => {
    const questionIds = Array.from({ length: 10 }, (_, i) => `q${i + 1}`)
    const questions = questionIds.map((id) =>
      makeQuestion(id, "multiple_choice", "option_a", "Explicacao"),
    )

    it("all 10 correct → score 100, status passed", () => {
      const answers = questionIds.map((id) => makeAnswer(id, "option_a"))
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBe(100)
      expect(result.correctCount).toBe(10)
      expect(result.totalScoreable).toBe(10)
      expect(result.status).toBe("passed")
      expect(result.feedback).toHaveLength(10)
      expect(result.feedback.every((f) => f.correct === true)).toBe(true)
    })

    it("all 10 wrong → score 0, status failed", () => {
      const answers = questionIds.map((id) => makeAnswer(id, "option_b"))
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBe(0)
      expect(result.correctCount).toBe(0)
      expect(result.status).toBe("failed")
      expect(result.feedback.every((f) => f.correct === false)).toBe(true)
    })

    it("7 correct out of 10 → score 70, status passed (passing_score = 70)", () => {
      const answers = questionIds.map((id, i) =>
        makeAnswer(id, i < 7 ? "option_a" : "option_b"),
      )
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBe(70)
      expect(result.correctCount).toBe(7)
      expect(result.status).toBe("passed")
    })

    it("score 65 with passing_score 70 → status failed", () => {
      const ids = Array.from({ length: 20 }, (_, i) => `q${i + 1}`)
      const qs = ids.map((id) => makeQuestion(id, "multiple_choice", "option_a"))
      const answers = ids.map((id, i) => makeAnswer(id, i < 13 ? "option_a" : "option_b"))
      const result = computeScore(ids, qs, answers, 70)

      expect(result.score).toBe(65)
      expect(result.status).toBe("failed")
    })

    it("score 70 with passing_score 70 → status passed (edge case equality)", () => {
      const ids = Array.from({ length: 10 }, (_, i) => `q${i + 1}`)
      const qs = ids.map((id) => makeQuestion(id, "multiple_choice", "option_a"))
      const answers = ids.map((id, i) => makeAnswer(id, i < 7 ? "option_a" : "option_b"))
      const result = computeScore(ids, qs, answers, 70)

      expect(result.score).toBe(70)
      expect(result.status).toBe("passed")
    })
  })

  describe("True/False scoring", () => {
    it("correct true/false answers are scored", () => {
      const questionIds = ["q1", "q2"]
      const questions = [
        makeQuestion("q1", "true_false", "true"),
        makeQuestion("q2", "true_false", "false"),
      ]
      const answers = [makeAnswer("q1", "true"), makeAnswer("q2", "false")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBe(100)
      expect(result.correctCount).toBe(2)
      expect(result.status).toBe("passed")
    })

    it("case insensitive comparison", () => {
      const questionIds = ["q1"]
      const questions = [makeQuestion("q1", "true_false", "True")]
      const answers = [makeAnswer("q1", "true")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.correctCount).toBe(1)
    })
  })

  describe("Open-ended scoring", () => {
    it("all open_ended → score null, status pending_review", () => {
      const questionIds = ["q1", "q2", "q3"]
      const questions = questionIds.map((id) => makeQuestion(id, "open_ended"))
      const answers = questionIds.map((id) => makeAnswer(id, "my answer"))
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBeNull()
      expect(result.correctCount).toBe(0)
      expect(result.totalScoreable).toBe(0)
      expect(result.status).toBe("pending_review")
      expect(result.feedback.every((f) => f.correct === null)).toBe(true)
      expect(result.feedback[0].explanation).toBe("Aguardando revisão do instrutor")
    })
  })

  describe("Mixed question types", () => {
    it("5 MC + 5 open_ended, 3 MC correct → score 60 (3/5)", () => {
      const mcIds = ["mc1", "mc2", "mc3", "mc4", "mc5"]
      const oeIds = ["oe1", "oe2", "oe3", "oe4", "oe5"]
      const questionIds = [...mcIds, ...oeIds]

      const questions = [
        ...mcIds.map((id) => makeQuestion(id, "multiple_choice", "option_a")),
        ...oeIds.map((id) => makeQuestion(id, "open_ended")),
      ]

      const answers = [
        makeAnswer("mc1", "option_a"), // correct
        makeAnswer("mc2", "option_a"), // correct
        makeAnswer("mc3", "option_a"), // correct
        makeAnswer("mc4", "option_b"), // wrong
        makeAnswer("mc5", "option_b"), // wrong
        ...oeIds.map((id) => makeAnswer(id, "some text")),
      ]

      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.score).toBe(60)
      expect(result.correctCount).toBe(3)
      expect(result.totalScoreable).toBe(5)
      expect(result.status).toBe("failed")
    })
  })

  describe("Edge cases", () => {
    it("unanswered question counted as incorrect", () => {
      const questionIds = ["q1", "q2"]
      const questions = [
        makeQuestion("q1", "multiple_choice", "option_a"),
        makeQuestion("q2", "multiple_choice", "option_a"),
      ]
      // Only answer q1, leave q2 unanswered
      const answers = [makeAnswer("q1", "option_a")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.correctCount).toBe(1)
      expect(result.totalScoreable).toBe(2)
      expect(result.score).toBe(50)
      expect(result.feedback[1].correct).toBe(false)
      expect(result.feedback[1].studentAnswer).toBe("")
    })

    it("empty answer string counted as incorrect", () => {
      const questionIds = ["q1"]
      const questions = [makeQuestion("q1", "multiple_choice", "option_a")]
      const answers = [makeAnswer("q1", "")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.correctCount).toBe(0)
      expect(result.feedback[0].correct).toBe(false)
    })

    it("feedback includes explanation from question", () => {
      const questionIds = ["q1"]
      const questions = [makeQuestion("q1", "multiple_choice", "option_a", "Porque A e correcto")]
      const answers = [makeAnswer("q1", "option_b")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.feedback[0].explanation).toBe("Porque A e correcto")
      expect(result.feedback[0].correctAnswer).toBe("option_a")
    })

    it("feedback is null explanation when question has no explanation", () => {
      const questionIds = ["q1"]
      const questions = [makeQuestion("q1", "multiple_choice", "option_a", null)]
      const answers = [makeAnswer("q1", "option_b")]
      const result = computeScore(questionIds, questions, answers, 70)

      expect(result.feedback[0].explanation).toBeNull()
    })

    it("zero questions → pending_review", () => {
      const result = computeScore([], [], [], 70)

      expect(result.score).toBeNull()
      expect(result.status).toBe("pending_review")
    })
  })
})
