import { describe, it, expect } from "vitest"
import { evaluateClosing, getDefaultMaxInteractions, buildClosingPromptSection } from "../src/closing"
import type { InteractionConfig } from "../src/types"
import { DEFAULT_INTERACTION_CONFIG } from "../src/types"

// ---------------------------------------------------------------------------
// evaluateClosing
// ---------------------------------------------------------------------------

describe("evaluateClosing", () => {
  const baseConfig: InteractionConfig = DEFAULT_INTERACTION_CONFIG

  const detectorData = {
    depth_progression: [2, 4, 6, 7],
    breakthrough_candidates: [
      { trigger: "pergunta aberta", marker: "insight-1" },
      { trigger: "reflexão", marker: "insight-2" },
    ],
  }

  describe("hard limit", () => {
    it("returns is_closing when interactionsRemaining is 0", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 0,
        turnNumber: 10,
        interactionType: "socratic_dialogue",
        config: baseConfig,
      })

      expect(flags.is_closing).toBe(true)
      expect(flags.suggest_closing).toBe(false)
      expect(flags.closing_reason).toBe("limit_reached")
    })

    it("returns is_closing when interactionsRemaining is negative", () => {
      const flags = evaluateClosing({
        interactionsRemaining: -1,
        turnNumber: 20,
        interactionType: "socratic_dialogue",
        config: baseConfig,
      })

      expect(flags.is_closing).toBe(true)
      expect(flags.closing_reason).toBe("limit_reached")
    })
  })

  describe("smart closing", () => {
    it("suggests closing when all conditions are met", () => {
      // Default smart_closing: min_interactions_before=5, depth_threshold=6, insights_threshold=2, remaining_threshold=5
      const flags = evaluateClosing({
        interactionsRemaining: 4, // <= 5 (remaining_threshold)
        turnNumber: 8, // >= 5 (min_interactions_before)
        interactionType: "socratic_dialogue",
        config: baseConfig,
        detectorData, // maxDepth=7 >= 6, insights=2 >= 2
      })

      expect(flags.is_closing).toBe(false)
      expect(flags.suggest_closing).toBe(true)
      expect(flags.closing_reason).toBe("smart_closing")
    })

    it("does not suggest when not enough interactions", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 4,
        turnNumber: 3, // < 5 (min_interactions_before)
        interactionType: "socratic_dialogue",
        config: baseConfig,
        detectorData,
      })

      expect(flags.suggest_closing).toBe(false)
      expect(flags.closing_reason).toBeNull()
    })

    it("does not suggest when depth not reached", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 4,
        turnNumber: 8,
        interactionType: "socratic_dialogue",
        config: baseConfig,
        detectorData: {
          depth_progression: [2, 3, 4], // max=4 < 6
          breakthrough_candidates: detectorData.breakthrough_candidates,
        },
      })

      expect(flags.suggest_closing).toBe(false)
    })

    it("does not suggest when not enough insights", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 4,
        turnNumber: 8,
        interactionType: "socratic_dialogue",
        config: baseConfig,
        detectorData: {
          depth_progression: detectorData.depth_progression,
          breakthrough_candidates: [{ trigger: "a", marker: "b" }], // only 1 < 2
        },
      })

      expect(flags.suggest_closing).toBe(false)
    })

    it("does not suggest when too many interactions remaining", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 10, // > 5 (remaining_threshold)
        turnNumber: 8,
        interactionType: "socratic_dialogue",
        config: baseConfig,
        detectorData,
      })

      expect(flags.suggest_closing).toBe(false)
    })

    it("does not suggest when smart_closing is disabled", () => {
      const disabledConfig: InteractionConfig = {
        ...baseConfig,
        smart_closing: { ...baseConfig.smart_closing, enabled: false },
      }

      const flags = evaluateClosing({
        interactionsRemaining: 4,
        turnNumber: 8,
        interactionType: "socratic_dialogue",
        config: disabledConfig,
        detectorData,
      })

      expect(flags.suggest_closing).toBe(false)
    })

    it("does not suggest when no detectorData provided", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 4,
        turnNumber: 8,
        interactionType: "socratic_dialogue",
        config: baseConfig,
        // no detectorData
      })

      expect(flags.suggest_closing).toBe(false)
    })
  })

  describe("no closing", () => {
    it("returns no flags when session is in normal flow", () => {
      const flags = evaluateClosing({
        interactionsRemaining: 15,
        turnNumber: 2,
        interactionType: "socratic_dialogue",
        config: baseConfig,
      })

      expect(flags.is_closing).toBe(false)
      expect(flags.suggest_closing).toBe(false)
      expect(flags.closing_reason).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// getDefaultMaxInteractions
// ---------------------------------------------------------------------------

describe("getDefaultMaxInteractions", () => {
  it("returns type-specific default for socratic_dialogue", () => {
    expect(getDefaultMaxInteractions("socratic_dialogue", DEFAULT_INTERACTION_CONFIG)).toBe(20)
  })

  it("returns type-specific default for quiz", () => {
    expect(getDefaultMaxInteractions("quiz", DEFAULT_INTERACTION_CONFIG)).toBe(8)
  })

  it("returns type-specific default for scenario", () => {
    expect(getDefaultMaxInteractions("scenario", DEFAULT_INTERACTION_CONFIG)).toBe(12)
  })

  it("returns type-specific default for assignment", () => {
    expect(getDefaultMaxInteractions("assignment", DEFAULT_INTERACTION_CONFIG)).toBe(15)
  })

  it("falls back to max_interactions for unknown type", () => {
    const config: InteractionConfig = {
      ...DEFAULT_INTERACTION_CONFIG,
      type_defaults: {} as InteractionConfig["type_defaults"],
    }
    expect(getDefaultMaxInteractions("socratic_dialogue", config)).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// buildClosingPromptSection
// ---------------------------------------------------------------------------

describe("buildClosingPromptSection", () => {
  it("returns closing instructions when is_closing is true", () => {
    const section = buildClosingPromptSection({
      is_closing: true,
      suggest_closing: false,
      closing_reason: "limit_reached",
    })

    expect(section).toContain("MODO FECHAMENTO SOCRATICO")
    expect(section).toContain("ultima interacao")
    expect(section).toContain("REGRAS DE FECHAMENTO")
    expect(section).toContain("NUNCA")
  })

  it("returns suggestion instructions when suggest_closing is true", () => {
    const section = buildClosingPromptSection({
      is_closing: false,
      suggest_closing: true,
      closing_reason: "smart_closing",
    })

    expect(section).toContain("SUGESTAO DE ENCERRAMENTO")
    expect(section).toContain("maturidade")
    expect(section).toContain("NAO force")
  })

  it("returns empty string when no closing flags", () => {
    const section = buildClosingPromptSection({
      is_closing: false,
      suggest_closing: false,
      closing_reason: null,
    })

    expect(section).toBe("")
  })

  it("prioritizes is_closing over suggest_closing", () => {
    const section = buildClosingPromptSection({
      is_closing: true,
      suggest_closing: true,
      closing_reason: "limit_reached",
    })

    expect(section).toContain("MODO FECHAMENTO SOCRATICO")
    expect(section).not.toContain("SUGESTAO DE ENCERRAMENTO")
  })
})
