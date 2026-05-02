import { describe, it, expect } from "vitest"
import { scoreEnneagram } from "../scoring"

describe("scoreEnneagram", () => {
  it("identifies type as first ranked paragraph", () => {
    const ranking = [5, 4, 6, 1, 2, 3, 7, 8, 9]
    const result = scoreEnneagram(ranking)
    expect(result.type).toBe(5)
  })

  it("identifies wing as adjacent type ranked highest", () => {
    // Type 5, adjacent are 4 and 6
    // 4 is at index 1, 6 is at index 2 -> wing is 4 (higher rank)
    const ranking = [5, 4, 6, 1, 2, 3, 7, 8, 9]
    const result = scoreEnneagram(ranking)
    expect(result.wing).toBe(4)
  })

  it("handles wing wrapping for type 1 (adjacent 9 and 2)", () => {
    const ranking = [1, 9, 2, 3, 4, 5, 6, 7, 8]
    const result = scoreEnneagram(ranking)
    expect(result.type).toBe(1)
    expect(result.wing).toBe(9) // 9 at index 1, 2 at index 2
  })

  it("handles wing wrapping for type 9 (adjacent 8 and 1)", () => {
    const ranking = [9, 1, 8, 2, 3, 4, 5, 6, 7]
    const result = scoreEnneagram(ranking)
    expect(result.type).toBe(9)
    expect(result.wing).toBe(1) // 1 at index 1, 8 at index 2
  })

  it("generates type-indexed scores array with 9 elements", () => {
    const ranking = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const result = scoreEnneagram(ranking)
    expect(result.scores).toHaveLength(9)
    // Type 1 is ranked first (index 0) → score = 9 - 0 = 9
    // scores[0] = score for type 1
    expect(result.scores[0]).toBe(9)
    // Type 9 is ranked last (index 8) → score = 9 - 8 = 1
    expect(result.scores[8]).toBe(1)
  })

  it("places scores at type-indexed positions", () => {
    // ranking: type 5 first, type 3 second, etc.
    const ranking = [5, 3, 7, 1, 2, 6, 4, 8, 9]
    const result = scoreEnneagram(ranking)
    // Type 5 is at index 0 → score 9. scores[4] (type 5 - 1) = 9
    expect(result.scores[4]).toBe(9)
    // Type 3 is at index 1 → score 8. scores[2] (type 3 - 1) = 8
    expect(result.scores[2]).toBe(8)
  })

  it("all scores are between 0 and 9", () => {
    const ranking = [5, 4, 6, 1, 2, 3, 7, 8, 9]
    const result = scoreEnneagram(ranking)
    for (const score of result.scores) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(9)
    }
  })

  it("throws on ranking with fewer than 2 entries", () => {
    expect(() => scoreEnneagram([5])).toThrow()
    expect(() => scoreEnneagram([])).toThrow()
  })
})
