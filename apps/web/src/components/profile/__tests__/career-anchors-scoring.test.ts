import { describe, it, expect } from "vitest"
import { scoreCareerAnchors, CAREER_ANCHORS_ITEMS } from "../scoring"

describe("scoreCareerAnchors", () => {
  it("scores all neutral when all answers are 3", () => {
    const answers: Record<number, number> = {}
    for (const item of CAREER_ANCHORS_ITEMS) {
      answers[item.id] = 3
    }
    const result = scoreCareerAnchors(answers)
    expect(result.technical).toBe(3)
    expect(result.management).toBe(3)
    expect(result.autonomy).toBe(3)
    expect(result.security).toBe(3)
    expect(result.entrepreneurship).toBe(3)
    expect(result.service).toBe(3)
    expect(result.challenge).toBe(3)
    expect(result.lifestyle).toBe(3)
  })

  it("returns top3 with highest scoring anchors", () => {
    const answers: Record<number, number> = {}
    // Give technical items max score (6)
    for (const item of CAREER_ANCHORS_ITEMS) {
      if (item.anchor === "technical") answers[item.id] = 6
      else if (item.anchor === "challenge") answers[item.id] = 5
      else if (item.anchor === "autonomy") answers[item.id] = 4
      else answers[item.id] = 1
    }
    const result = scoreCareerAnchors(answers)
    expect(result.top3).toHaveLength(3)
    expect(result.top3[0]).toBe("technical")
    expect(result.top3[1]).toBe("challenge")
    expect(result.top3[2]).toBe("autonomy")
  })

  it("scores max when all answers are 6", () => {
    const answers: Record<number, number> = {}
    for (const item of CAREER_ANCHORS_ITEMS) {
      answers[item.id] = 6
    }
    const result = scoreCareerAnchors(answers)
    expect(result.technical).toBe(6)
    expect(result.lifestyle).toBe(6)
  })

  it("returns values between 1 and 6 for all anchors", () => {
    const answers: Record<number, number> = {}
    for (const item of CAREER_ANCHORS_ITEMS) {
      answers[item.id] = (item.id % 6) + 1
    }
    const result = scoreCareerAnchors(answers)
    const anchors = ["technical", "management", "autonomy", "security", "entrepreneurship", "service", "challenge", "lifestyle"]
    for (const key of anchors) {
      const val = (result as unknown as Record<string, number>)[key]
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(6)
    }
  })

  it("has 40 items covering 8 anchors with 5 each", () => {
    expect(CAREER_ANCHORS_ITEMS).toHaveLength(40)
    const counts: Record<string, number> = {}
    for (const item of CAREER_ANCHORS_ITEMS) {
      counts[item.anchor] = (counts[item.anchor] || 0) + 1
    }
    expect(Object.keys(counts)).toHaveLength(8)
    for (const count of Object.values(counts)) {
      expect(count).toBe(5)
    }
  })

  it("defaults unanswered items to 3.5", () => {
    const result = scoreCareerAnchors({})
    expect(result.technical).toBe(3.5)
    expect(result.top3).toHaveLength(3)
  })
})
