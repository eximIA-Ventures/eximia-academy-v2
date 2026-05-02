import { describe, expect, it } from "vitest"
import {
  type PartialBriefInput,
  calculateBriefScore,
  courseDesignerInputSchema,
  getBriefScoreRating,
  validateBrief,
} from "../schemas/input"

const validInput = {
  course_title: "Gestão de Projetos Ágeis",
  business_goal: "Reduzir tempo de entrega de projetos em 30%",
  behavior_change: "Aplicar metodologias ágeis no dia a dia da equipe",
  success_metrics: ["NPS > 8", "Velocidade +20%"],
  problem_statement: "Equipes entregam projetos com atraso e sem priorização",
  target_audience: {
    role: "Gerente de Projetos",
    experience_level: "intermediario" as const,
    prior_knowledge: ["PMBOK basics"],
    group_size: 30,
    motivation_context: "Promoção vinculada a certificação",
  },
  core_competencies: ["Scrum", "Kanban", "Sprint Planning"],
  topics_outline: ["Fundamentos Ágeis", "Scrum na prática"],
  context_files: [{ name: "guia.pdf", type: "pdf" as const }],
  total_duration_hours: 40,
  constraints: {
    weeks: 8,
    hours_per_week: 5,
    delivery_mode: "online_sync" as const,
    cohort_based: true,
  },
  framework: "elc_plus" as const,
  interaction_strategy: "dominant" as const,
  dominant_interaction_type: "socratic_dialogue" as const,
  language: "pt-br" as const,
}

describe("courseDesignerInputSchema (Story 20.3 AC1+AC4)", () => {
  it("accepts valid complete input", () => {
    expect(() => courseDesignerInputSchema.parse(validInput)).not.toThrow()
  })

  it("rejects when dominant_interaction_type missing with strategy=dominant", () => {
    const input = { ...validInput, dominant_interaction_type: undefined }
    const result = courseDesignerInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("accepts when dominant_interaction_type missing with strategy=bloom_mapped", () => {
    const input = {
      ...validInput,
      interaction_strategy: "bloom_mapped" as const,
      dominant_interaction_type: undefined,
    }
    expect(() => courseDesignerInputSchema.parse(input)).not.toThrow()
  })

  it("rejects when no content source provided", () => {
    const input = {
      ...validInput,
      core_competencies: undefined,
      topics_outline: undefined,
      context_files: undefined,
      source_course_id: undefined,
    }
    const result = courseDesignerInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe("validateBrief (Story 20.3 AC2)", () => {
  it("returns valid for complete input", () => {
    const result = validateBrief(validInput)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("returns errors for empty input", () => {
    const result = validateBrief({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })

  it("returns error when no content source", () => {
    const input: PartialBriefInput = {
      business_goal: "Melhorar performance",
      target_audience: { role: "Dev", experience_level: "intermediario" },
      total_duration_hours: 10,
    }
    const result = validateBrief(input)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("fonte de conteúdo"))).toBe(true)
  })

  it("warns when goal lacks action verb", () => {
    const input: PartialBriefInput = {
      ...validInput,
      business_goal: "A equipe precisa ser mais produtiva",
    }
    const result = validateBrief(input)
    expect(result.warnings.some((w) => w.includes("verbo de ação"))).toBe(true)
  })

  it("warns when duration < 4h", () => {
    const input: PartialBriefInput = { ...validInput, total_duration_hours: 2 }
    const result = validateBrief(input)
    expect(result.warnings.some((w) => w.includes("4h"))).toBe(true)
  })

  it("warns when group > 50 without cohort", () => {
    const input: PartialBriefInput = {
      ...validInput,
      target_audience: { ...validInput.target_audience, group_size: 100 },
      constraints: { ...validInput.constraints, cohort_based: undefined },
    }
    const result = validateBrief(input)
    expect(result.warnings.some((w) => w.includes("cohort"))).toBe(true)
  })
})

describe("calculateBriefScore (Story 20.3 AC3)", () => {
  it("returns 100 for fully-filled brief", () => {
    const score = calculateBriefScore(validInput)
    expect(score).toBe(100)
  })

  it("returns 0 for empty input", () => {
    const score = calculateBriefScore({})
    expect(score).toBe(0)
  })

  it("returns partial score for partial input", () => {
    const input: PartialBriefInput = {
      course_title: "Test",
      business_goal: "Improve X",
      target_audience: { role: "Dev", experience_level: "intermediario" },
      total_duration_hours: 10,
      core_competencies: ["Skill A"],
    }
    // title 5 + goal 10 + role 8 + experience 8 + duration 8 + competencies 10 = 49
    expect(calculateBriefScore(input)).toBe(49)
  })
})

describe("getBriefScoreRating (Story 20.3 AC3)", () => {
  it("returns Excelente for 90-100", () => {
    expect(getBriefScoreRating(100)).toBe("Excelente")
    expect(getBriefScoreRating(90)).toBe("Excelente")
  })

  it("returns Bom for 70-89", () => {
    expect(getBriefScoreRating(89)).toBe("Bom")
    expect(getBriefScoreRating(70)).toBe("Bom")
  })

  it("returns Suficiente for 50-69", () => {
    expect(getBriefScoreRating(69)).toBe("Suficiente")
    expect(getBriefScoreRating(50)).toBe("Suficiente")
  })

  it("returns Mínimo for <50", () => {
    expect(getBriefScoreRating(49)).toBe("Mínimo")
    expect(getBriefScoreRating(0)).toBe("Mínimo")
  })
})
