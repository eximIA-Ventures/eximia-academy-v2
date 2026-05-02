import { describe, expect, it } from "vitest"
import { createCourseSchema, updateCourseSchema } from "../../src/validators/courses"

describe("createCourseSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
      description: "Um curso completo sobre IA",
    })
    expect(result.success).toBe(true)
  })

  it("accepts valid input without description", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
    })
    expect(result.success).toBe(true)
  })

  it("rejects title shorter than 10 characters", () => {
    const result = createCourseSchema.safeParse({
      title: "Curso",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("mínimo 10")
    }
  })

  it("rejects missing title", () => {
    const result = createCourseSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("validates 'regular' type", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
      type: "regular",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("regular")
    }
  })

  it("validates 'onboarding' type", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
      type: "onboarding",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("onboarding")
    }
  })

  it("rejects invalid type", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
      type: "invalid",
    })
    expect(result.success).toBe(false)
  })

  it("defaults to 'regular' when type omitted", () => {
    const result = createCourseSchema.safeParse({
      title: "Fundamentos de IA Aplicada",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("regular")
    }
  })
})


describe("updateCourseSchema", () => {
  it("accepts valid update with id and all fields", () => {
    const result = updateCourseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Titulo Atualizado do Curso",
    })
    expect(result.success).toBe(true)
  })

  it("accepts partial update with only id and title", () => {
    const result = updateCourseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Novo Título do Curso",
    })
    expect(result.success).toBe(true)
  })

  it("requires valid uuid for id", () => {
    const result = updateCourseSchema.safeParse({
      id: "not-a-uuid",
      title: "Titulo Atualizado do Curso",
    })
    expect(result.success).toBe(false)
  })

  it("requires id field", () => {
    const result = updateCourseSchema.safeParse({
      title: "Titulo Atualizado do Curso",
    })
    expect(result.success).toBe(false)
  })
})
