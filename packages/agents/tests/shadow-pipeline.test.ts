import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DetectorOutput } from "../src/schemas/detector"
import type { PerfiladorOutput } from "../src/schemas/perfilador"
import type {
  ShadowInput,
  ShadowPipelineConfig,
  ShadowPersistence,
  ExistingLearnerProfile,
} from "../src/shadow-pipeline"

// Mock AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
}))

vi.mock("../src/model-router", () => ({
  getModelWithFallback: vi.fn(() => "mock-router-model"),
}))

vi.mock("@sentry/node", () => ({
  startSpan: vi.fn((_opts, fn) => fn({ setAttribute: vi.fn() })),
  captureException: vi.fn(),
}))

import { generateObject } from "ai"
import {
  shouldRunPerfilador,
  runDetector,
  runPerfilador,
  mergeProfileData,
  buildAnalyticsUpdate,
  executeShadowPipeline,
  DEFAULT_SHADOW_CONFIG,
} from "../src/shadow-pipeline"

const mockGenerateObject = vi.mocked(generateObject)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseShadowInput: ShadowInput = {
  sessionId: "sess-1",
  studentId: "student-1",
  tenantId: "tenant-1",
  studentMessage: "Eu acho que sim.",
  tutorResponse: "Interessante, por que você pensa assim?",
  conversationHistory: [
    { role: "user", content: "Ola" },
    { role: "assistant", content: "Ola, vamos comecar?" },
  ],
  chapterContent: "Capítulo sobre sustentabilidade...",
  turnNumber: 5,
}

const makeDetectorOutput = (): DetectorOutput => ({
  cognitive_patterns: {
    dominant_patterns: [
      { pattern: "simplificacao", evidence: "Resposta curta", frequency: "medium" },
    ],
    implicit_values: ["praticidade"],
    cognitive_loops: [],
    readiness_level: "exploring",
    suggested_question_type: "perspectiva",
  },
  ai_detection: {
    probability: 0.1,
    confidence: "high",
    verdict: "likely_human",
    indicators: [],
    flag: null,
  },
  linguistic_analysis: {
    emotional_density: 0.4,
    abstraction_level: 4,
    certainty_vs_exploration: 0.2,
    defense_active: false,
  },
  session_journey: {
    emotional_arc: ["curiosidade", "reflexão"],
    depth_progression: [2, 3, 4],
    breakthrough_candidates: [{ trigger: "pergunta aberta", marker: "insight" }],
  },
})

const makePerfiladorOutput = (): PerfiladorOutput => ({
  preferred_question_types: ["clarificacao", "perspectiva"],
  engagement_style: "balanced",
  detail_orientation: "concise",
  reasoning_style: "analytical",
  avg_depth_achieved: 4,
  comprehension_trend: "improving",
  avg_qa_score: 0.7,
  strengths: ["pensamento critico", "curiosidade"],
  growth_areas: ["aprofundamento"],
  adaptation_hints: ["usar exemplos concretos"],
  summary: "Aluno com perfil analitico em evolucao.",
  confidence: 0.6,
  kolb_profile: {
    grasping_axis: 0.3,
    transforming_axis: -0.2,
    dominant_style: "assimilador",
    style_confidence: 0.5,
    indicators_observed: [
      { indicator: "reflexão", weight: 0.7, evidence: "Pausa antes de responder" },
    ],
  },
})

const makeExistingProfile = (): ExistingLearnerProfile => ({
  engagement_style: "reflective",
  detail_orientation: "verbose",
  reasoning_style: "systematic",
  avg_depth_achieved: 3,
  avg_qa_score: 0.5,
  confidence: 0.3,
  kolb_grasping_axis: 0.1,
  kolb_transforming_axis: 0.1,
  kolb_dominant_style: "divergente",
  kolb_style_confidence: 0.4,
  strengths: ["curiosidade"],
  growth_areas: ["profundidade"],
  adaptation_hints: ["mais exemplos"],
  preferred_question_types: ["clarificacao"],
  comprehension_trend: "stable",
  summary: "Perfil anterior.",
  session_count: 3,
})

const makeMockPersistence = (): ShadowPersistence => ({
  getExistingProfile: vi.fn().mockResolvedValue(null),
  getSessionAnalytics: vi.fn().mockResolvedValue({}),
  updateSessionAnalytics: vi.fn().mockResolvedValue(undefined),
  upsertLearnerProfile: vi.fn().mockResolvedValue(undefined),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe("shouldRunPerfilador", () => {
  it("returns true when turnNumber is multiple of interval", () => {
    expect(shouldRunPerfilador(5, 5)).toBe(true)
    expect(shouldRunPerfilador(10, 5)).toBe(true)
    expect(shouldRunPerfilador(15, 5)).toBe(true)
  })

  it("returns false when turnNumber is not a multiple", () => {
    expect(shouldRunPerfilador(1, 5)).toBe(false)
    expect(shouldRunPerfilador(3, 5)).toBe(false)
    expect(shouldRunPerfilador(7, 5)).toBe(false)
  })

  it("returns false for turnNumber 0", () => {
    expect(shouldRunPerfilador(0, 5)).toBe(false)
  })

  it("uses default interval of 5", () => {
    expect(shouldRunPerfilador(5)).toBe(true)
    expect(shouldRunPerfilador(4)).toBe(false)
  })
})

describe("runDetector", () => {
  it("calls generateObject with detector schema and returns output", async () => {
    const detectorOutput = makeDetectorOutput()
    mockGenerateObject.mockResolvedValueOnce({ object: detectorOutput } as never)

    const result = await runDetector(baseShadowInput)

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    expect(result).toEqual(detectorOutput)
  })

  it("truncates chapter content to 3000 chars", async () => {
    const longContent = "A".repeat(5000)
    const input = { ...baseShadowInput, chapterContent: longContent }
    const detectorOutput = makeDetectorOutput()
    mockGenerateObject.mockResolvedValueOnce({ object: detectorOutput } as never)

    await runDetector(input)

    const call = mockGenerateObject.mock.calls[0]?.[0] as { prompt: string }
    expect(call.prompt).toContain("A".repeat(3000))
    expect(call.prompt).not.toContain("A".repeat(3001))
  })

  it("shows 'Primeira interacao' for empty history", async () => {
    const input = { ...baseShadowInput, conversationHistory: [] }
    mockGenerateObject.mockResolvedValueOnce({ object: makeDetectorOutput() } as never)

    await runDetector(input)

    const call = mockGenerateObject.mock.calls[0]?.[0] as { prompt: string }
    expect(call.prompt).toContain("Primeira interacao")
  })

  it("uses model router when tenantPlan is provided", async () => {
    const input = { ...baseShadowInput, tenantPlan: "standard" as const }
    mockGenerateObject.mockResolvedValueOnce({ object: makeDetectorOutput() } as never)

    await runDetector(input)

    const call = mockGenerateObject.mock.calls[0]?.[0] as { model: unknown }
    expect(call.model).toBe("mock-router-model")
  })
})

describe("runPerfilador", () => {
  it("generates perfilador output with no existing profile", async () => {
    const perfiladorOutput = makePerfiladorOutput()
    mockGenerateObject.mockResolvedValueOnce({ object: perfiladorOutput } as never)

    const result = await runPerfilador(baseShadowInput, null, makeDetectorOutput())

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    expect(result).toEqual(perfiladorOutput)
  })

  it("passes session count from existing profile", async () => {
    const existing = makeExistingProfile()
    mockGenerateObject.mockResolvedValueOnce({ object: makePerfiladorOutput() } as never)

    await runPerfilador(baseShadowInput, existing, makeDetectorOutput())

    const call = mockGenerateObject.mock.calls[0]?.[0] as { prompt: string }
    expect(call.prompt).toContain("Sessões Anteriores: 3")
  })
})

describe("mergeProfileData", () => {
  it("creates initial profile when no existing data (confidence capped at 0.15)", () => {
    const perfiladorOutput = makePerfiladorOutput()
    const merged = mergeProfileData(null, perfiladorOutput, 0)

    expect(merged.engagement_style).toBe("balanced")
    expect(merged.confidence).toBeLessThanOrEqual(0.15)
    expect(merged.session_count).toBe(1)
    expect(merged.kolb_grasping_axis).toBe(0.3)
    expect(merged.kolb_dominant_style).toBe("assimilador")
    expect((merged.strengths as string[]).length).toBeLessThanOrEqual(5)
    expect((merged.growth_areas as string[]).length).toBeLessThanOrEqual(3)
  })

  it("merges incrementally with existing profile", () => {
    const existing = makeExistingProfile()
    const newProfile = makePerfiladorOutput()
    const merged = mergeProfileData(existing, newProfile, 3)

    // Incremental average: (old * n + new) / (n + 1)
    const expectedDepth = (3 * 3 + 4) / 4
    expect(merged.avg_depth_achieved).toBeCloseTo(expectedDepth, 5)

    const expectedQa = (0.5 * 3 + 0.7) / 4
    expect(merged.avg_qa_score).toBeCloseTo(expectedQa, 5)

    expect(merged.session_count).toBe(4)
  })

  it("caps confidence based on session count", () => {
    const existing = makeExistingProfile()

    // With 4 sessions (3+1), confidence cap is 0.7 (sessions <= 10)
    const newProfile = makePerfiladorOutput()
    newProfile.confidence = 0.95
    const merged = mergeProfileData(existing, newProfile, 3)
    expect(merged.confidence).toBeLessThanOrEqual(0.7)
  })

  it("merges strengths arrays without duplicates", () => {
    const existing = makeExistingProfile()
    existing.strengths = ["curiosidade", "analise"]
    const newProfile = makePerfiladorOutput()
    newProfile.strengths = ["curiosidade", "pensamento critico"]
    const merged = mergeProfileData(existing, newProfile, 3)

    const strengths = merged.strengths as string[]
    expect(strengths).toContain("curiosidade")
    expect(strengths).toContain("analise")
    expect(strengths).toContain("pensamento critico")
    // No duplicates
    expect(new Set(strengths).size).toBe(strengths.length)
    expect(strengths.length).toBeLessThanOrEqual(5)
  })

  it("merges Kolb axes incrementally", () => {
    const existing = makeExistingProfile()
    const newProfile = makePerfiladorOutput()
    const merged = mergeProfileData(existing, newProfile, 3)

    const expectedGrasping = (0.1 * 3 + 0.3) / 4
    expect(merged.kolb_grasping_axis).toBeCloseTo(expectedGrasping, 5)
  })
})

describe("buildAnalyticsUpdate", () => {
  it("builds analytics from detector output", () => {
    const detectorOutput = makeDetectorOutput()
    const result = buildAnalyticsUpdate({}, detectorOutput)

    expect(result.cognitive_patterns).toEqual(["simplificacao"])
    expect(result.defense_mechanisms).toEqual([])
    expect(result.values_revealed).toEqual(["praticidade"])
    expect(result.depth_progression).toEqual([2, 3, 4])
    expect(result.depth_reached).toBe(4)
    expect(result.breakthrough_moments).toBe(1)
    expect(result.emotional_journey).toEqual(["curiosidade", "reflexão"])
  })

  it("preserves existing analytics fields", () => {
    const existing = { custom_field: "keep_me" }
    const result = buildAnalyticsUpdate(existing, makeDetectorOutput())

    expect(result.custom_field).toBe("keep_me")
  })

  it("appends to existing emotional_density_progression", () => {
    const existing = { emotional_density_progression: [0.2, 0.3] }
    const detectorOutput = makeDetectorOutput()
    const result = buildAnalyticsUpdate(existing, detectorOutput)

    expect(result.emotional_density_progression).toEqual([0.2, 0.3, 0.4])
  })

  it("handles empty depth_progression with depth_reached = 0", () => {
    const detectorOutput = makeDetectorOutput()
    detectorOutput.session_journey.depth_progression = []
    const result = buildAnalyticsUpdate({}, detectorOutput)

    expect(result.depth_reached).toBe(0)
  })

  it("computes Kolb session vector from linguistic analysis", () => {
    const detectorOutput = makeDetectorOutput()
    const result = buildAnalyticsUpdate({}, detectorOutput)
    const kolb = result.kolb_session_vector as {
      grasping_axis: number
      transforming_axis: number
    }

    // grasping = (abstraction_level - 5.5) / 4.5 = (4 - 5.5) / 4.5
    expect(kolb.grasping_axis).toBeCloseTo((4 - 5.5) / 4.5, 5)
    expect(kolb.transforming_axis).toBe(0.2)
  })
})

describe("executeShadowPipeline", () => {
  it("runs detector and saves analytics (happy path, turnNumber not multiple of interval)", async () => {
    const detectorOutput = makeDetectorOutput()
    mockGenerateObject.mockResolvedValueOnce({ object: detectorOutput } as never)
    const persistence = makeMockPersistence()
    const input = { ...baseShadowInput, turnNumber: 3 } // not a multiple of 5

    const result = await executeShadowPipeline(input, persistence)

    expect(result.detector).toEqual(detectorOutput)
    expect(result.perfilador).toBeNull()
    expect(result.detectorError).toBeUndefined()
    expect(persistence.getSessionAnalytics).toHaveBeenCalledWith("sess-1")
    expect(persistence.updateSessionAnalytics).toHaveBeenCalledWith("sess-1", expect.any(Object))
    // Perfilador should NOT run
    expect(persistence.getExistingProfile).not.toHaveBeenCalled()
    expect(persistence.upsertLearnerProfile).not.toHaveBeenCalled()
  })

  it("runs detector + perfilador when turnNumber is multiple of interval", async () => {
    const detectorOutput = makeDetectorOutput()
    const perfiladorOutput = makePerfiladorOutput()
    mockGenerateObject
      .mockResolvedValueOnce({ object: detectorOutput } as never)
      .mockResolvedValueOnce({ object: perfiladorOutput } as never)
    const persistence = makeMockPersistence()

    const result = await executeShadowPipeline(
      { ...baseShadowInput, turnNumber: 5 },
      persistence,
    )

    expect(result.detector).toEqual(detectorOutput)
    expect(result.perfilador).toEqual(perfiladorOutput)
    expect(persistence.getExistingProfile).toHaveBeenCalledWith("student-1", "tenant-1")
    expect(persistence.upsertLearnerProfile).toHaveBeenCalledWith(
      "student-1",
      "tenant-1",
      expect.objectContaining({ session_count: 1 }),
    )
  })

  it("captures detector error and returns gracefully", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("API down"))
    const persistence = makeMockPersistence()

    const result = await executeShadowPipeline(baseShadowInput, persistence)

    expect(result.detector).toBeNull()
    expect(result.detectorError).toBe("API down")
    expect(result.perfilador).toBeNull()
    // Should not attempt analytics save or perfilador
    expect(persistence.updateSessionAnalytics).not.toHaveBeenCalled()
  })

  it("captures analytics save error but still runs perfilador", async () => {
    const detectorOutput = makeDetectorOutput()
    const perfiladorOutput = makePerfiladorOutput()
    mockGenerateObject
      .mockResolvedValueOnce({ object: detectorOutput } as never)
      .mockResolvedValueOnce({ object: perfiladorOutput } as never)
    const persistence = makeMockPersistence()
    ;(persistence.getSessionAnalytics as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB error"),
    )

    const result = await executeShadowPipeline(
      { ...baseShadowInput, turnNumber: 5 },
      persistence,
    )

    expect(result.detector).toEqual(detectorOutput)
    expect(result.detectorError).toBe("DB error")
    // Perfilador still runs
    expect(result.perfilador).toEqual(perfiladorOutput)
  })

  it("captures perfilador error and returns gracefully", async () => {
    const detectorOutput = makeDetectorOutput()
    mockGenerateObject
      .mockResolvedValueOnce({ object: detectorOutput } as never)
      .mockRejectedValueOnce(new Error("Perfilador timeout"))
    const persistence = makeMockPersistence()

    const result = await executeShadowPipeline(
      { ...baseShadowInput, turnNumber: 10 },
      persistence,
    )

    expect(result.detector).toEqual(detectorOutput)
    expect(result.perfilador).toBeNull()
    expect(result.perfiladorError).toBe("Perfilador timeout")
  })

  it("uses custom config for perfilador interval", async () => {
    const detectorOutput = makeDetectorOutput()
    const perfiladorOutput = makePerfiladorOutput()
    mockGenerateObject
      .mockResolvedValueOnce({ object: detectorOutput } as never)
      .mockResolvedValueOnce({ object: perfiladorOutput } as never)
    const persistence = makeMockPersistence()
    const config: ShadowPipelineConfig = {
      ...DEFAULT_SHADOW_CONFIG,
      perfiladorInterval: 3,
    }

    const result = await executeShadowPipeline(
      { ...baseShadowInput, turnNumber: 3 },
      persistence,
      config,
    )

    expect(result.perfilador).toEqual(perfiladorOutput)
  })
})
