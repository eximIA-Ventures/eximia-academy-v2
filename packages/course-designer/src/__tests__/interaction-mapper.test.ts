import { describe, expect, it } from "vitest"
import { mapBloomToInteraction, mapInteractions } from "../interaction-mapper"
import type { BloomLevel, SpiralLevel } from "../schemas/shared"

describe("mapBloomToInteraction (Story 24.1 AC6)", () => {
  describe("base Bloom mapping (no spiral adjustments)", () => {
    it("remembering → quiz", () => {
      expect(mapBloomToInteraction("remembering", "variacao")).toBe("quiz")
    })

    it("understanding → quiz", () => {
      expect(mapBloomToInteraction("understanding", "variacao")).toBe("quiz")
    })

    it("applying → socratic_dialogue", () => {
      expect(mapBloomToInteraction("applying", "variacao")).toBe("socratic_dialogue")
    })

    it("analyzing → socratic_dialogue", () => {
      expect(mapBloomToInteraction("analyzing", "variacao")).toBe("socratic_dialogue")
    })

    it("evaluating → scenario", () => {
      expect(mapBloomToInteraction("evaluating", "variacao")).toBe("scenario")
    })

    it("creating → assignment", () => {
      expect(mapBloomToInteraction("creating", "variacao")).toBe("assignment")
    })
  })

  describe("positional adjustments per spiral level", () => {
    it("sintese: ALWAYS returns assignment regardless of Bloom", () => {
      const allBlooms: BloomLevel[] = [
        "remembering",
        "understanding",
        "applying",
        "analyzing",
        "evaluating",
        "creating",
      ]
      for (const bloom of allBlooms) {
        expect(mapBloomToInteraction(bloom, "sintese")).toBe("assignment")
      }
    })

    it("fundamentos + analyzing → socratic_dialogue (not scenario)", () => {
      expect(mapBloomToInteraction("analyzing", "fundamentos")).toBe("socratic_dialogue")
    })

    it("fundamentos + evaluating → socratic_dialogue (too early for scenario)", () => {
      expect(mapBloomToInteraction("evaluating", "fundamentos")).toBe("socratic_dialogue")
    })

    it("fundamentos + creating → socratic_dialogue (too early for assignment)", () => {
      expect(mapBloomToInteraction("creating", "fundamentos")).toBe("socratic_dialogue")
    })

    it("fundamentos + remembering → quiz (no adjustment)", () => {
      expect(mapBloomToInteraction("remembering", "fundamentos")).toBe("quiz")
    })

    it("conflito_humano + applying → scenario (human trade-offs)", () => {
      expect(mapBloomToInteraction("applying", "conflito_humano")).toBe("scenario")
    })

    it("conflito_humano + analyzing → socratic_dialogue (no adjustment)", () => {
      expect(mapBloomToInteraction("analyzing", "conflito_humano")).toBe("socratic_dialogue")
    })

    it("mundo_real + remembering → scenario (real context)", () => {
      expect(mapBloomToInteraction("remembering", "mundo_real")).toBe("scenario")
    })

    it("mundo_real + understanding → scenario (real context)", () => {
      expect(mapBloomToInteraction("understanding", "mundo_real")).toBe("scenario")
    })

    it("mundo_real + applying → scenario (real context)", () => {
      expect(mapBloomToInteraction("applying", "mundo_real")).toBe("scenario")
    })

    it("mundo_real + analyzing → scenario (real context)", () => {
      expect(mapBloomToInteraction("analyzing", "mundo_real")).toBe("scenario")
    })

    it("mundo_real + evaluating → scenario (base mapping)", () => {
      expect(mapBloomToInteraction("evaluating", "mundo_real")).toBe("scenario")
    })

    it("mundo_real + creating → assignment (base mapping)", () => {
      expect(mapBloomToInteraction("creating", "mundo_real")).toBe("assignment")
    })
  })
})

describe("mapInteractions (Story 24.1 AC6)", () => {
  const modules = [
    { bloom_level: "remembering" as BloomLevel, spiral_level: "fundamentos" as SpiralLevel },
    { bloom_level: "applying" as BloomLevel, spiral_level: "variacao" as SpiralLevel },
    { bloom_level: "creating" as BloomLevel, spiral_level: "sintese" as SpiralLevel },
  ]

  describe("bloom_mapped strategy", () => {
    it("maps each module based on bloom + spiral", () => {
      const result = mapInteractions(modules, "bloom_mapped")
      expect(result).toEqual(["quiz", "socratic_dialogue", "assignment"])
    })
  })

  describe("dominant strategy", () => {
    it("returns same type for all modules", () => {
      const result = mapInteractions(modules, "dominant", "quiz")
      expect(result).toEqual(["quiz", "quiz", "quiz"])
    })

    it("throws when dominantType not provided", () => {
      expect(() => mapInteractions(modules, "dominant")).toThrow(
        "dominant_interaction_type is required",
      )
    })
  })

  describe("custom strategy", () => {
    it("uses bloom_mapped as base (instructor edits later)", () => {
      const result = mapInteractions(modules, "custom")
      expect(result).toEqual(["quiz", "socratic_dialogue", "assignment"])
    })
  })
})
