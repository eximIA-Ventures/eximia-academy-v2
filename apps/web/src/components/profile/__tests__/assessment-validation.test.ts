import { describe, it, expect } from "vitest"
import { z } from "zod"

// Replicate Zod schemas from perfil/actions.ts for pure testing
const bigFiveResultSchema = z.object({
  openness: z.number().min(1).max(5),
  conscientiousness: z.number().min(1).max(5),
  extraversion: z.number().min(1).max(5),
  agreeableness: z.number().min(1).max(5),
  neuroticism: z.number().min(1).max(5),
})

const enneagramResultSchema = z.object({
  type: z.number().min(1).max(9),
  wing: z.number().min(1).max(9).optional(),
  scores: z.array(z.number().min(0).max(9)).length(9),
})

const discResultSchema = z.object({
  d: z.number().min(0).max(100),
  i: z.number().min(0).max(100),
  s: z.number().min(0).max(100),
  c: z.number().min(0).max(100),
})

const multipleIntelligencesResultSchema = z.object({
  linguistic: z.number().min(1).max(5),
  logical: z.number().min(1).max(5),
  spatial: z.number().min(1).max(5),
  musical: z.number().min(1).max(5),
  kinesthetic: z.number().min(1).max(5),
  interpersonal: z.number().min(1).max(5),
  intrapersonal: z.number().min(1).max(5),
  naturalist: z.number().min(1).max(5),
})

const careerAnchorsResultSchema = z.object({
  technical: z.number().min(1).max(6),
  management: z.number().min(1).max(6),
  autonomy: z.number().min(1).max(6),
  security: z.number().min(1).max(6),
  entrepreneurship: z.number().min(1).max(6),
  service: z.number().min(1).max(6),
  challenge: z.number().min(1).max(6),
  lifestyle: z.number().min(1).max(6),
  top3: z.array(z.string().max(200)).length(3),
})

const assessmentResultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("big_five"), result: bigFiveResultSchema }),
  z.object({ type: z.literal("enneagram"), result: enneagramResultSchema }),
  z.object({ type: z.literal("disc"), result: discResultSchema }),
  z.object({ type: z.literal("multiple_intelligences"), result: multipleIntelligencesResultSchema }),
  z.object({ type: z.literal("career_anchors"), result: careerAnchorsResultSchema }),
])

describe("Assessment Result — Zod Validation (Story 9.3)", () => {
  describe("Big Five validation", () => {
    it("accepts valid Big Five result", () => {
      const payload = {
        type: "big_five" as const,
        result: {
          openness: 3.5,
          conscientiousness: 4.0,
          extraversion: 2.5,
          agreeableness: 4.5,
          neuroticism: 1.5,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("rejects Big Five result with values > 5", () => {
      const payload = {
        type: "big_five" as const,
        result: {
          openness: 6,
          conscientiousness: 4,
          extraversion: 3,
          agreeableness: 4,
          neuroticism: 2,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Big Five result with values < 1", () => {
      const payload = {
        type: "big_five" as const,
        result: {
          openness: 0,
          conscientiousness: 4,
          extraversion: 3,
          agreeableness: 4,
          neuroticism: 2,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Big Five result with missing dimension", () => {
      const payload = {
        type: "big_five" as const,
        result: {
          openness: 3,
          conscientiousness: 4,
          extraversion: 3,
          // missing agreeableness
          neuroticism: 2,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe("Enneagram validation", () => {
    it("accepts valid Enneagram result", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 5,
          wing: 4,
          scores: [9, 8, 7, 6, 5, 4, 3, 2, 1],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("accepts Enneagram result without wing", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 1,
          scores: [9, 8, 7, 6, 5, 4, 3, 2, 1],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("rejects Enneagram result with type > 9", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 10,
          scores: [9, 8, 7, 6, 5, 4, 3, 2, 1],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Enneagram result with wrong scores length", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 5,
          scores: [9, 8, 7],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Enneagram result with scores > 9", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 5,
          scores: [10, 8, 7, 6, 5, 4, 3, 2, 1],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Enneagram result with scores < 0", () => {
      const payload = {
        type: "enneagram" as const,
        result: {
          type: 5,
          scores: [-1, 8, 7, 6, 5, 4, 3, 2, 1],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe("DISC validation", () => {
    it("accepts valid DISC result", () => {
      const payload = {
        type: "disc" as const,
        result: { d: 35, i: 25, s: 20, c: 20 },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("rejects DISC result with values > 100", () => {
      const payload = {
        type: "disc" as const,
        result: { d: 101, i: 25, s: 20, c: 20 },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects DISC result with negative values", () => {
      const payload = {
        type: "disc" as const,
        result: { d: -1, i: 25, s: 20, c: 20 },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe("Multiple Intelligences validation", () => {
    it("accepts valid MI result", () => {
      const payload = {
        type: "multiple_intelligences" as const,
        result: {
          linguistic: 4.2, logical: 3.8, spatial: 3.0, musical: 2.5,
          kinesthetic: 4.0, interpersonal: 3.5, intrapersonal: 4.5, naturalist: 2.0,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("rejects MI result with values > 5", () => {
      const payload = {
        type: "multiple_intelligences" as const,
        result: {
          linguistic: 6, logical: 3, spatial: 3, musical: 3,
          kinesthetic: 3, interpersonal: 3, intrapersonal: 3, naturalist: 3,
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects MI result with missing intelligence", () => {
      const payload = {
        type: "multiple_intelligences" as const,
        result: {
          linguistic: 3, logical: 3, spatial: 3, musical: 3,
          // missing kinesthetic, interpersonal, intrapersonal, naturalist
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe("Career Anchors validation", () => {
    it("accepts valid Career Anchors result", () => {
      const payload = {
        type: "career_anchors" as const,
        result: {
          technical: 5.2, management: 3.0, autonomy: 4.5, security: 2.0,
          entrepreneurship: 4.8, service: 3.5, challenge: 5.0, lifestyle: 4.0,
          top3: ["technical", "challenge", "entrepreneurship"],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it("rejects Career Anchors result with values > 6", () => {
      const payload = {
        type: "career_anchors" as const,
        result: {
          technical: 7, management: 3, autonomy: 3, security: 3,
          entrepreneurship: 3, service: 3, challenge: 3, lifestyle: 3,
          top3: ["technical", "management", "autonomy"],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Career Anchors result with wrong top3 length", () => {
      const payload = {
        type: "career_anchors" as const,
        result: {
          technical: 5, management: 3, autonomy: 4, security: 2,
          entrepreneurship: 4, service: 3, challenge: 5, lifestyle: 4,
          top3: ["technical"],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects Career Anchors result with top3 strings exceeding 200 chars", () => {
      const longString = "a".repeat(201)
      const payload = {
        type: "career_anchors" as const,
        result: {
          technical: 5, management: 3, autonomy: 4, security: 2,
          entrepreneurship: 4, service: 3, challenge: 5, lifestyle: 4,
          top3: [longString, "management", "autonomy"],
        },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe("Discriminated union", () => {
    it("rejects unknown assessment type", () => {
      const payload = {
        type: "unknown_test",
        result: { foo: "bar" },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it("rejects payload without type field", () => {
      const payload = {
        result: { openness: 3 },
      }
      const result = assessmentResultSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })
})
