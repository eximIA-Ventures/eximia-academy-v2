import { describe, it, expect } from "vitest"
import { scoreMultipleIntelligences, MULTIPLE_INTELLIGENCES_ITEMS } from "../scoring"

describe("scoreMultipleIntelligences", () => {
  it("scores all neutral when all answers are 3", () => {
    const answers: Record<number, number> = {}
    for (const item of MULTIPLE_INTELLIGENCES_ITEMS) {
      answers[item.id] = 3
    }
    const result = scoreMultipleIntelligences(answers)
    expect(result.linguistic).toBe(3)
    expect(result.logical).toBe(3)
    expect(result.spatial).toBe(3)
    expect(result.musical).toBe(3)
    expect(result.kinesthetic).toBe(3)
    expect(result.interpersonal).toBe(3)
    expect(result.intrapersonal).toBe(3)
    expect(result.naturalist).toBe(3)
  })

  it("scores max when all answers are 5", () => {
    const answers: Record<number, number> = {}
    for (const item of MULTIPLE_INTELLIGENCES_ITEMS) {
      answers[item.id] = 5
    }
    const result = scoreMultipleIntelligences(answers)
    expect(result.linguistic).toBe(5)
    expect(result.logical).toBe(5)
  })

  it("scores min when all answers are 1", () => {
    const answers: Record<number, number> = {}
    for (const item of MULTIPLE_INTELLIGENCES_ITEMS) {
      answers[item.id] = 1
    }
    const result = scoreMultipleIntelligences(answers)
    expect(result.linguistic).toBe(1)
    expect(result.logical).toBe(1)
  })

  it("returns values between 1 and 5 for all intelligences", () => {
    const answers: Record<number, number> = {}
    for (const item of MULTIPLE_INTELLIGENCES_ITEMS) {
      answers[item.id] = item.id % 5 + 1
    }
    const result = scoreMultipleIntelligences(answers)
    for (const key of Object.keys(result)) {
      const val = (result as unknown as Record<string, number>)[key]
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(5)
    }
  })

  it("has 40 items covering 8 intelligences with 5 each", () => {
    expect(MULTIPLE_INTELLIGENCES_ITEMS).toHaveLength(40)
    const counts: Record<string, number> = {}
    for (const item of MULTIPLE_INTELLIGENCES_ITEMS) {
      counts[item.intelligence] = (counts[item.intelligence] || 0) + 1
    }
    expect(Object.keys(counts)).toHaveLength(8)
    for (const count of Object.values(counts)) {
      expect(count).toBe(5)
    }
  })

  it("defaults unanswered items to 3", () => {
    const result = scoreMultipleIntelligences({})
    expect(result.linguistic).toBe(3)
    expect(result.naturalist).toBe(3)
  })
})
