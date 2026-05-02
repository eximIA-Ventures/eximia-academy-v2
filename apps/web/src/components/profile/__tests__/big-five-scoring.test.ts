import { describe, it, expect } from "vitest"
import { scoreBigFive } from "../scoring"

describe("scoreBigFive", () => {
  it("calculates correct scores with all answers = 5", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 5
    const result = scoreBigFive(answers)
    // Non-reversed items: 5, reversed items: 6-5 = 1
    // Each dimension has 2 normal + 2 reversed = (5+5+1+1)/4 = 3
    expect(result.extraversion).toBe(3)
    expect(result.agreeableness).toBe(3)
    expect(result.conscientiousness).toBe(3)
    expect(result.neuroticism).toBe(3)
    expect(result.openness).toBe(3)
  })

  it("calculates correct scores with all answers = 1", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 1
    const result = scoreBigFive(answers)
    // Non-reversed: 1, reversed: 6-1 = 5
    // (1+1+5+5)/4 = 3
    expect(result.extraversion).toBe(3)
  })

  it("scores reversed items correctly", () => {
    // Item 2 is reversed (extraversion), give it 2 -> score should be 4
    // Items 1,3 not reversed with value 4 -> score 4
    // Item 4 reversed with value 2 -> score 4
    const answers: Record<number, number> = { 1: 4, 2: 2, 3: 4, 4: 2 }
    // Only fill extraversion items, others default to 3
    for (let i = 5; i <= 20; i++) answers[i] = 3
    const result = scoreBigFive(answers)
    expect(result.extraversion).toBe(4) // (4 + 4 + 4 + 4) / 4
  })

  it("returns values between 1 and 5", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 3
    const result = scoreBigFive(answers)
    for (const key of Object.keys(result)) {
      const val = (result as unknown as Record<string, number>)[key]
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(5)
    }
  })

  it("clamps out-of-range input values to 1-5", () => {
    const answers: Record<number, number> = {}
    for (let i = 1; i <= 20; i++) answers[i] = 10 // out of range
    const result = scoreBigFive(answers)
    for (const key of Object.keys(result)) {
      const val = (result as unknown as Record<string, number>)[key]
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(5)
    }
  })

  it("defaults unanswered items to 3", () => {
    const result = scoreBigFive({})
    expect(result.openness).toBe(3)
    expect(result.extraversion).toBe(3)
  })
})
