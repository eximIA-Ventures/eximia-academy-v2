import { describe, expect, it } from "vitest"
import { evaluateNeuroscienceRules } from "../neuroscience-rules"
import type { ArchitectOutput } from "../schemas/architect"
import type { CalculatorOutput } from "../schemas/calculator"

// --- Helpers: minimal valid module for Architect ---

const VALID_OBJECTIVE = {
  text: "Apply concepts effectively",
  bloom_level: "applying" as const,
  abcd: { audience: "Gestores", behavior: "Aplicar", condition: "Em contexto real", degree: "Com 80% de acerto" },
}

const VALID_ASSESSMENT = {
  type: "formative" as const,
  method: "quiz" as const,
  description: "Quiz formativo",
  alignment: "Objetivo 1",
  kirkpatrick_level: "L2" as const,
}

const VALID_FRAMEWORK_STAGE = {
  key: "engage",
  name: "Engajamento",
  percentage: 100,
  activities: ["Atividade 1"],
}

const VALID_PROBLEMA_MOTOR = {
  description: "Como aplicar?",
  pressure: 3,
  ambiguity: 2,
  stakes: 3,
  tension_score: 18,
}

function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    order: 1,
    title: "Module 1",
    description: "Test module",
    spiral_level: "fundamentos" as const,
    objectives: [VALID_OBJECTIVE],
    assessments: [VALID_ASSESSMENT],
    framework_stages: [VALID_FRAMEWORK_STAGE],
    problema_motor: VALID_PROBLEMA_MOTOR,
    rubrics: null,
    interaction_type: "socratic_dialogue" as const,
    ...overrides,
  }
}

function makeArchitectOutput(
  overrides: Partial<ArchitectOutput> = {},
): ArchitectOutput {
  return {
    course_structure: {
      total_modules: 1,
      primary_framework: "elc_plus",
      complementary_frameworks: [],
      bloom_progression: ["applying"],
      spiral_levels: ["fundamentos"],
    },
    modules: [makeModule()],
    assessment_strategy: {
      formative_count: 1,
      summative_count: 0,
      diagnostic_count: 0,
      overall_approach: "Avaliação contínua",
      kirkpatrick_coverage: { L1: true, L2: true, L3: false, L4: false },
    },
    ...overrides,
  }
}

// --- Helpers: minimal valid module for Calculator ---

function makeTimeModule(overrides: Record<string, unknown> = {}) {
  return {
    module_order: 1,
    total_minutes: 120,
    per_stage: { engage: 120 },
    chunks: [
      { title: "Content", type: "content" as const, duration_min: 25 },
      { title: "Activity", type: "activity" as const, duration_min: 20 },
      { title: "Reflection", type: "reflection" as const, duration_min: 15 },
    ],
    ...overrides,
  }
}

function makeCogModule(overrides: Record<string, unknown> = {}) {
  return {
    module_order: 1,
    intrinsic_load: "medium" as const,
    extraneous_load: "low" as const,
    germane_load: "medium" as const,
    new_concepts_count: 4,
    concurrent_concepts: 3,
    recommendation: "OK",
    ...overrides,
  }
}

function makeCalculatorOutput(
  overrides: Partial<CalculatorOutput> = {},
): CalculatorOutput {
  return {
    time_allocation: {
      total_minutes: 120,
      modules: [makeTimeModule()],
      attention_span_respected: true,
    },
    cognitive_load: {
      modules: [makeCogModule()],
      overall_balance: "optimal" as const,
      warnings: [],
    },
    pacing_strategy: {
      recommended_schedule: "1x por semana",
      spaced_repetition_points: [],
      break_pattern: "25min + 5min pausa",
    },
    ...overrides,
  }
}

describe("evaluateNeuroscienceRules (Story 24.1 AC5)", () => {
  it("returns total score 100 when all rules pass", () => {
    const arch = makeArchitectOutput()
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 120,
        modules: [makeTimeModule({
          chunks: [
            { title: "Content", type: "content" as const, duration_min: 25 },
            { title: "Activity", type: "activity" as const, duration_min: 20 },
          ],
        })],
        attention_span_respected: true,
      },
      cognitive_load: {
        modules: [makeCogModule({ new_concepts_count: 3 })],
        overall_balance: "optimal" as const,
        warnings: [],
      },
    })
    const result = evaluateNeuroscienceRules(arch, calc)
    expect(result.total).toBe(100)
    expect(result.rules).toHaveLength(7)
    for (const rule of result.rules) {
      expect(rule.passed).toBe(true)
    }
  })

  it("weights sum to 100", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    const weightSum = result.rules.reduce((sum, r) => sum + r.weight, 0)
    expect(weightSum).toBe(100)
  })

  it("returns 7 rules with unique IDs N1-N7", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    const ids = result.rules.map((r) => r.id)
    expect(ids).toEqual(["N1", "N2", "N3", "N4", "N5", "N6", "N7"])
  })
})

describe("N1: CLT chunk_size <= 5 concepts", () => {
  it("passes when all modules have <= 5 concepts", () => {
    const calc = makeCalculatorOutput({
      cognitive_load: {
        modules: [makeCogModule({ new_concepts_count: 5 })],
        overall_balance: "optimal" as const,
        warnings: [],
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    expect(result.rules.find((r) => r.id === "N1")!.passed).toBe(true)
  })

  it("fails when a module exceeds 5 concepts", () => {
    const calc = makeCalculatorOutput({
      cognitive_load: {
        modules: [makeCogModule({ new_concepts_count: 8 })],
        overall_balance: "overloaded" as const,
        warnings: ["Module 1 overloaded"],
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    const n1 = result.rules.find((r) => r.id === "N1")!
    expect(n1.passed).toBe(false)
    expect(n1.details).toContain("M1(8)")
  })

  it("has weight 20", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N1")!.weight).toBe(20)
  })
})

describe("N2: AGES attention < 30min without pause", () => {
  it("passes when all chunks <= 30min", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N2")!.passed).toBe(true)
  })

  it("fails when a chunk exceeds 30min", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 120,
        modules: [makeTimeModule({
          chunks: [{ title: "Long content", type: "content" as const, duration_min: 45 }],
        })],
        attention_span_respected: false,
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    const n2 = result.rules.find((r) => r.id === "N2")!
    expect(n2.passed).toBe(false)
    expect(n2.details).toContain("45min")
  })

  it("has weight 15", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N2")!.weight).toBe(15)
  })
})

describe("N3: AGES generation >= 1 activity/module", () => {
  it("passes when module has activity chunk", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N3")!.passed).toBe(true)
  })

  it("fails when module has no activity/assessment/reflection chunks", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 60,
        modules: [makeTimeModule({
          total_minutes: 60,
          chunks: [
            { title: "Content only", type: "content" as const, duration_min: 30 },
            { title: "More content", type: "content" as const, duration_min: 30 },
          ],
        })],
        attention_span_respected: true,
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    const n3 = result.rules.find((r) => r.id === "N3")!
    expect(n3.passed).toBe(false)
    expect(n3.details).toContain("1")
  })

  it("has weight 20", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N3")!.weight).toBe(20)
  })
})

describe("N4: AGES emotion >= 50% modules with hook", () => {
  it("passes when >= 50% modules have problema_motor", () => {
    const arch = makeArchitectOutput({
      modules: [
        makeModule({ order: 1, problema_motor: VALID_PROBLEMA_MOTOR }),
        makeModule({ order: 2, title: "M2", spiral_level: "variacao" as const, problema_motor: null }),
      ],
    })
    const result = evaluateNeuroscienceRules(arch, makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N4")!.passed).toBe(true)
  })

  it("fails when < 50% modules have problema_motor", () => {
    const arch = makeArchitectOutput({
      modules: [
        makeModule({ order: 1, problema_motor: null }),
        makeModule({ order: 2, title: "M2", spiral_level: "variacao" as const, problema_motor: null }),
        makeModule({ order: 3, title: "M3", spiral_level: "conflito_humano" as const, interaction_type: "scenario" as const, problema_motor: VALID_PROBLEMA_MOTOR }),
      ],
    })
    const result = evaluateNeuroscienceRules(arch, makeCalculatorOutput())
    const n4 = result.rules.find((r) => r.id === "N4")!
    expect(n4.passed).toBe(false)
    expect(n4.details).toContain("1/3")
  })

  it("has weight 10", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N4")!.weight).toBe(10)
  })
})

describe("N5: Spacing schedule if > 4h", () => {
  it("auto-passes for courses <= 4h", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 180,
        modules: [],
        attention_span_respected: true,
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    const n5 = result.rules.find((r) => r.id === "N5")!
    expect(n5.passed).toBe(true)
    expect(n5.details).toContain("≤ 4h")
  })

  it("passes for > 4h with spaced repetition points", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 600,
        modules: [],
        attention_span_respected: true,
      },
      pacing_strategy: {
        recommended_schedule: "1x por semana",
        spaced_repetition_points: ["Após módulo 2", "Após módulo 4"],
        break_pattern: "25+5",
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    expect(result.rules.find((r) => r.id === "N5")!.passed).toBe(true)
  })

  it("fails for > 4h without spaced repetition", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 600,
        modules: [],
        attention_span_respected: true,
      },
      pacing_strategy: {
        recommended_schedule: "1x por semana",
        spaced_repetition_points: [],
        break_pattern: "25+5",
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    expect(result.rules.find((r) => r.id === "N5")!.passed).toBe(false)
  })

  it("has weight 15", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N5")!.weight).toBe(15)
  })
})

describe("N6: Retrieval >= 1 formative quiz/module", () => {
  it("passes when all modules have formative assessment", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N6")!.passed).toBe(true)
  })

  it("fails when a module lacks formative assessment", () => {
    const summativeOnly = {
      type: "summative" as const,
      method: "rubric" as const,
      description: "Avaliação final",
      alignment: "Objetivo 1",
      kirkpatrick_level: "L2" as const,
    }
    const arch = makeArchitectOutput({
      modules: [makeModule({ assessments: [summativeOnly] })],
    })
    const result = evaluateNeuroscienceRules(arch, makeCalculatorOutput())
    const n6 = result.rules.find((r) => r.id === "N6")!
    expect(n6.passed).toBe(false)
    expect(n6.details).toContain("1")
  })

  it("has weight 15", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N6")!.weight).toBe(15)
  })
})

describe("N7: Dual Coding visual + textual", () => {
  it("passes when modules have varied chunk types", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N7")!.passed).toBe(true)
  })

  it("fails when a module has single chunk type", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 60,
        modules: [makeTimeModule({
          total_minutes: 60,
          chunks: [
            { title: "Part 1", type: "content" as const, duration_min: 30 },
            { title: "Part 2", type: "content" as const, duration_min: 30 },
          ],
        })],
        attention_span_respected: true,
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    const n7 = result.rules.find((r) => r.id === "N7")!
    expect(n7.passed).toBe(false)
    expect(n7.details).toContain("1")
  })

  it("has weight 5", () => {
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), makeCalculatorOutput())
    expect(result.rules.find((r) => r.id === "N7")!.weight).toBe(5)
  })
})

describe("Score calculation", () => {
  it("returns 0 when all rules fail", () => {
    const noFormativeAssessment = {
      type: "summative" as const,
      method: "rubric" as const,
      description: "Exam",
      alignment: "O1",
      kirkpatrick_level: "L2" as const,
    }
    const arch = makeArchitectOutput({
      modules: [
        makeModule({ order: 1, problema_motor: null, assessments: [noFormativeAssessment] }),
        makeModule({ order: 2, title: "M2", spiral_level: "variacao" as const, problema_motor: null, assessments: [noFormativeAssessment] }),
      ],
    })
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 600,
        modules: [
          makeTimeModule({
            module_order: 1,
            total_minutes: 300,
            chunks: [{ title: "Long", type: "content" as const, duration_min: 45 }],
          }),
          makeTimeModule({
            module_order: 2,
            total_minutes: 300,
            chunks: [{ title: "Long 2", type: "content" as const, duration_min: 50 }],
          }),
        ],
        attention_span_respected: false,
      },
      cognitive_load: {
        modules: [
          makeCogModule({ module_order: 1, new_concepts_count: 10 }),
          makeCogModule({ module_order: 2, new_concepts_count: 8 }),
        ],
        overall_balance: "overloaded" as const,
        warnings: ["Overloaded"],
      },
      pacing_strategy: {
        recommended_schedule: "N/A",
        spaced_repetition_points: [],
        break_pattern: "N/A",
      },
    })
    const result = evaluateNeuroscienceRules(arch, calc)
    expect(result.total).toBe(0)
  })

  it("returns partial score when some rules pass", () => {
    const calc = makeCalculatorOutput({
      time_allocation: {
        total_minutes: 120,
        modules: [makeTimeModule({
          chunks: [{ title: "Content", type: "content" as const, duration_min: 45 }],
        })],
        attention_span_respected: false,
      },
      cognitive_load: {
        modules: [makeCogModule({ new_concepts_count: 3 })],
        overall_balance: "optimal" as const,
        warnings: [],
      },
    })
    const result = evaluateNeuroscienceRules(makeArchitectOutput(), calc)
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(100)
  })
})
