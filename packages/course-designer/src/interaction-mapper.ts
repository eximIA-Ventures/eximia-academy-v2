import type { InteractionType } from "@eximia/shared"
import type { BloomLevel, SpiralLevel } from "./schemas/shared"

/**
 * Interaction Mapper — Maps Bloom level + spiral level to interaction type.
 *
 * Strategies:
 * - bloom_mapped: Assigns interaction_type by Bloom + spiral_level (default, D17)
 * - dominant: Uses a single interaction_type chosen by the instructor for all modules
 * - custom: Generates with bloom_mapped, instructor edits later
 */

interface ModuleForMapping {
  bloom_level: BloomLevel
  spiral_level: SpiralLevel
}

// --- Base Bloom → InteractionType mapping (Architecture §9.1) ---

const BLOOM_TO_INTERACTION: Record<BloomLevel, InteractionType> = {
  remembering: "quiz",
  understanding: "quiz",
  applying: "socratic_dialogue",
  analyzing: "socratic_dialogue",
  evaluating: "scenario",
  creating: "assignment",
}

// --- Bloom level ordering for comparison ---

const BLOOM_ORDER: Record<BloomLevel, number> = {
  remembering: 0,
  understanding: 1,
  applying: 2,
  analyzing: 3,
  evaluating: 4,
  creating: 5,
}

// --- Spiral level ordering ---

const SPIRAL_ORDER: Record<SpiralLevel, number> = {
  fundamentos: 1,
  variacao: 3,
  conflito_humano: 5,
  mundo_real: 7,
  sintese: 9,
}

/**
 * bloom_mapped strategy with positional adjustments per spiral_level.
 *
 * Adjustments (Architecture §9.1):
 * - fundamentos (1-2): If Bloom >= Analyze → keep socratic (too early for scenario)
 * - variacao (3-4): No adjustment
 * - conflito_humano (5-6): If Bloom == Apply → upgrade to scenario (human trade-offs)
 * - mundo_real (7-8): If Bloom <= Analyze → upgrade to scenario (real context)
 * - síntese (9-10): FORCE assignment (mandatory final deliverable)
 */
export function mapBloomToInteraction(
  bloomLevel: BloomLevel,
  spiralLevel: SpiralLevel,
): InteractionType {
  const bloomIdx = BLOOM_ORDER[bloomLevel]

  // Síntese: always assignment (mandatory final deliverable)
  if (spiralLevel === "sintese") {
    return "assignment"
  }

  // Fundamentos: if Bloom >= analyzing, keep socratic_dialogue (too early for scenario)
  if (spiralLevel === "fundamentos" && bloomIdx >= BLOOM_ORDER.analyzing) {
    return "socratic_dialogue"
  }

  // Conflito humano: if Bloom == applying, upgrade to scenario (human trade-offs)
  if (spiralLevel === "conflito_humano" && bloomLevel === "applying") {
    return "scenario"
  }

  // Mundo real: if Bloom <= analyzing, upgrade to scenario (real context)
  if (spiralLevel === "mundo_real" && bloomIdx <= BLOOM_ORDER.analyzing) {
    return "scenario"
  }

  // Default: base Bloom mapping
  return BLOOM_TO_INTERACTION[bloomLevel]
}

/**
 * Maps interaction types for a list of modules based on the chosen strategy.
 *
 * @param modules - Array of modules with bloom_level and spiral_level
 * @param strategy - "bloom_mapped" | "dominant" | "custom"
 * @param dominantType - Required when strategy is "dominant"
 * @returns Array of InteractionType in the same order as input modules
 */
export function mapInteractions(
  modules: ModuleForMapping[],
  strategy: "bloom_mapped" | "dominant" | "custom",
  dominantType?: InteractionType,
): InteractionType[] {
  switch (strategy) {
    case "dominant": {
      if (!dominantType) {
        throw new Error("dominant_interaction_type is required when strategy is 'dominant'")
      }
      return modules.map(() => dominantType)
    }
    case "bloom_mapped":
    case "custom":
      // custom uses bloom_mapped as base, instructor edits later
      return modules.map((m) => mapBloomToInteraction(m.bloom_level, m.spiral_level))
  }
}
