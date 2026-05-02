import { describe, expect, it } from "vitest"
import {
  bloomLevelSchema,
  frameworkConfigSchema,
  frameworkIdSchema,
  interactionTypeSchema,
  qualityVerdictSchema,
  spiralLevelSchema,
} from "../schemas/shared"

describe("Enum Schemas (Story 20.1)", () => {
  it("bloomLevelSchema accepts all 6 levels", () => {
    const levels = [
      "remembering",
      "understanding",
      "applying",
      "analyzing",
      "evaluating",
      "creating",
    ]
    for (const level of levels) {
      expect(bloomLevelSchema.parse(level)).toBe(level)
    }
  })

  it("bloomLevelSchema rejects invalid value", () => {
    expect(() => bloomLevelSchema.parse("invalid")).toThrow()
  })

  it("spiralLevelSchema accepts all 5 levels", () => {
    const levels = ["fundamentos", "variacao", "conflito_humano", "mundo_real", "sintese"]
    for (const level of levels) {
      expect(spiralLevelSchema.parse(level)).toBe(level)
    }
  })

  it("spiralLevelSchema rejects invalid value", () => {
    expect(() => spiralLevelSchema.parse("invalid")).toThrow()
  })

  it("qualityVerdictSchema accepts all 4 verdicts", () => {
    const verdicts = ["excellent", "good", "needs_revision", "poor"]
    for (const v of verdicts) {
      expect(qualityVerdictSchema.parse(v)).toBe(v)
    }
  })

  it("frameworkIdSchema accepts 3 ids", () => {
    const ids = ["elc_plus", "kolb_4", "pbl_hmelo"]
    for (const id of ids) {
      expect(frameworkIdSchema.parse(id)).toBe(id)
    }
  })

  it("interactionTypeSchema accepts 4 types", () => {
    const types = ["socratic_dialogue", "quiz", "scenario", "assignment"]
    for (const t of types) {
      expect(interactionTypeSchema.parse(t)).toBe(t)
    }
  })
})

describe("frameworkConfigSchema (Story 20.1)", () => {
  const validConfig = {
    id: "elc_plus",
    name: "Test Framework",
    type: "learning_cycle" as const,
    stages: [
      {
        id: "s1",
        name: "Stage 1",
        description: "Desc",
        time_percentage: 100,
        default_interaction: "quiz",
        purpose: "Test",
      },
    ],
    sequencing: { model: "spiral" as const, progression_rule: "bloom_ascending" },
    bloom_interaction_map: {
      remembering: { interaction: "quiz", turns: 8, depth_range: [1, 2] as [number, number] },
      understanding: { interaction: "quiz", turns: 8, depth_range: [2, 3] as [number, number] },
      applying: {
        interaction: "socratic_dialogue",
        turns: 20,
        depth_range: [3, 4] as [number, number],
      },
      analyzing: {
        interaction: "socratic_dialogue",
        turns: 20,
        depth_range: [4, 5] as [number, number],
      },
      evaluating: { interaction: "scenario", turns: 12, depth_range: [5, 6] as [number, number] },
      creating: { interaction: "assignment", turns: 15, depth_range: [6, 7] as [number, number] },
    },
    positional_adjustments: [],
    quality_criteria: [
      {
        id: "c1",
        name: "Criterion",
        weight: 100,
        validation_rule: "rule",
        failure_message: "fail",
      },
    ],
    assessment_dimensions: [
      { name: "Dim1", weight: 100, levels: [{ score: 0, label: "low", description: "d" }] },
    ],
  }

  it("accepts a valid FrameworkConfig", () => {
    expect(() => frameworkConfigSchema.parse(validConfig)).not.toThrow()
  })

  it("rejects config with invalid framework id", () => {
    expect(() => frameworkConfigSchema.parse({ ...validConfig, id: "invalid" })).toThrow()
  })

  it("rejects config with wrong type literal", () => {
    expect(() => frameworkConfigSchema.parse({ ...validConfig, type: "other" })).toThrow()
  })
})
