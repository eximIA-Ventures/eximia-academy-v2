import { describe, expect, it } from "vitest"
import {
  createChapterSchema,
  updateChapterSchema,
  reorderChaptersSchema,
} from "../../src/validators/chapters"

describe("createChapterSchema", () => {
  const validContent = "A".repeat(100)

  it("accepts valid input with all fields", () => {
    const result = createChapterSchema.safeParse({
      title: "Introducao",
      content: validContent,
      learning_objective: "Entender os fundamentos",
    })
    expect(result.success).toBe(true)
  })

  it("accepts without learning_objective", () => {
    const result = createChapterSchema.safeParse({
      title: "Introducao",
      content: validContent,
    })
    expect(result.success).toBe(true)
  })

  it("rejects content with less than 100 chars", () => {
    const result = createChapterSchema.safeParse({
      title: "Introducao",
      content: "Curto demais",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("100")
    }
  })

  it("accepts content with exactly 100 chars", () => {
    const result = createChapterSchema.safeParse({
      title: "Introducao",
      content: "A".repeat(100),
    })
    expect(result.success).toBe(true)
  })

  it("rejects content with 99 chars", () => {
    const result = createChapterSchema.safeParse({
      title: "Introducao",
      content: "A".repeat(99),
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing title", () => {
    const result = createChapterSchema.safeParse({
      content: validContent,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty title", () => {
    const result = createChapterSchema.safeParse({
      title: "",
      content: validContent,
    })
    expect(result.success).toBe(false)
  })
})

describe("updateChapterSchema", () => {
  it("accepts partial update with id", () => {
    const result = updateChapterSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Titulo Atualizado",
    })
    expect(result.success).toBe(true)
  })

  it("requires valid uuid for id", () => {
    const result = updateChapterSchema.safeParse({
      id: "not-valid",
      title: "Test",
    })
    expect(result.success).toBe(false)
  })
})

describe("reorderChaptersSchema", () => {
  it("accepts valid reorder array", () => {
    const result = reorderChaptersSchema.safeParse([
      { id: "550e8400-e29b-41d4-a716-446655440000", order: 0 },
      { id: "550e8400-e29b-41d4-a716-446655440001", order: 1 },
    ])
    expect(result.success).toBe(true)
  })

  it("rejects negative order", () => {
    const result = reorderChaptersSchema.safeParse([
      { id: "550e8400-e29b-41d4-a716-446655440000", order: -1 },
    ])
    expect(result.success).toBe(false)
  })

  it("accepts empty array", () => {
    const result = reorderChaptersSchema.safeParse([])
    expect(result.success).toBe(true)
  })
})
