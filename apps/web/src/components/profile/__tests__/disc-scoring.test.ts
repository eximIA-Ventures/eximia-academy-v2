import { describe, it, expect } from "vitest"
import { scoreDISC, DISC_ITEMS } from "../scoring"

describe("scoreDISC", () => {
  it("scores all D when choosing D options", () => {
    const answers: Record<number, "a" | "b"> = {}
    for (const item of DISC_ITEMS) {
      answers[item.id] = item.a.dimension === "D" ? "a" : "b"
    }
    const result = scoreDISC(answers)
    expect(result.d).toBeGreaterThan(result.i)
    expect(result.d).toBeGreaterThan(result.s)
    expect(result.d).toBeGreaterThan(result.c)
  })

  it("returns percentages that sum to exactly 100", () => {
    const answers: Record<number, "a" | "b"> = {}
    for (const item of DISC_ITEMS) {
      answers[item.id] = "a"
    }
    const result = scoreDISC(answers)
    const total = result.d + result.i + result.s + result.c
    expect(total).toBe(100)
  })

  it("handles empty answers returning zeros", () => {
    const result = scoreDISC({})
    expect(result.d).toBe(0)
    expect(result.i).toBe(0)
    expect(result.s).toBe(0)
    expect(result.c).toBe(0)
  })

  it("handles partial answers with exact sum of 100", () => {
    const answers: Record<number, "a" | "b"> = { 1: "a", 2: "b" }
    const result = scoreDISC(answers)
    const total = result.d + result.i + result.s + result.c
    expect(total).toBe(100)
  })

  it("ignores invalid item ids (string keys)", () => {
    const answers = { 1: "a", 999: "b" } as Record<number, "a" | "b">
    const result = scoreDISC(answers)
    // item 999 doesn't exist, should be skipped gracefully
    const total = result.d + result.i + result.s + result.c
    expect(total).toBe(100)
  })

  it("has 28 items covering all 4 dimensions", () => {
    expect(DISC_ITEMS).toHaveLength(28)
    const dimensions = new Set<string>()
    for (const item of DISC_ITEMS) {
      dimensions.add(item.a.dimension)
      dimensions.add(item.b.dimension)
    }
    expect(dimensions).toContain("D")
    expect(dimensions).toContain("I")
    expect(dimensions).toContain("S")
    expect(dimensions).toContain("C")
  })
})
