/**
 * Adaptation Hints — Story 29.5
 *
 * Pure rules-based engine that maps Big Five + DISC scores
 * to pedagogical adaptation hints for the Mestre pipeline.
 *
 * These hints are injected into the system prompt so the
 * dialogue adapts subtly to the learner's personality profile.
 */

// ---- Input types ----

export interface BigFiveInput {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

export interface DISCInput {
  d: number
  i: number
  s: number
  c: number
}

export interface ProfileScores {
  bigFive?: BigFiveInput | null
  disc?: DISCInput | null
}

// ---- Output type ----

export interface AdaptationHints {
  communication_style: string
  content_preferences: string
  challenge_level: string
  pace_preference: string
  examples_type: string
}

// ---- Thresholds ----

const HIGH = 67
const LOW = 34

// ---- Neutral defaults (no assessment data) ----

const NEUTRAL_HINTS: AdaptationHints = {
  communication_style: "equilibrado",
  content_preferences: "misto",
  challenge_level: "moderado",
  pace_preference: "adaptavel",
  examples_type: "variados",
}

// ---- Helper: get dominant DISC type ----

function getDominantDISC(disc: DISCInput): "D" | "I" | "S" | "C" {
  const entries: Array<{ key: "D" | "I" | "S" | "C"; value: number }> = [
    { key: "D", value: disc.d },
    { key: "I", value: disc.i },
    { key: "S", value: disc.s },
    { key: "C", value: disc.c },
  ]
  entries.sort((a, b) => b.value - a.value)
  return entries[0].key
}

// ---- Big Five rules ----

function hintsFromBigFive(bf: BigFiveInput): Partial<AdaptationHints> {
  const hints: Partial<AdaptationHints> = {}

  // Openness → examples_type + content_preferences
  if (bf.openness >= HIGH) {
    hints.examples_type = "criativos e exploratorios"
    hints.content_preferences = "conceitual com conexoes interdisciplinares"
  } else if (bf.openness < LOW) {
    hints.examples_type = "praticos e aplicados"
    hints.content_preferences = "direto e objetivo com aplicacao imediata"
  }

  // Conscientiousness → pace_preference
  if (bf.conscientiousness >= HIGH) {
    hints.pace_preference = "estruturado com etapas claras"
  } else if (bf.conscientiousness < LOW) {
    hints.pace_preference = "flexivel e dinamico"
  }

  // Extraversion → communication_style
  if (bf.extraversion >= HIGH) {
    hints.communication_style = "interativo e colaborativo"
  } else if (bf.extraversion < LOW) {
    hints.communication_style = "reflexivo e individual"
  }

  // Agreeableness → communication_style refinement
  if (bf.agreeableness >= HIGH) {
    hints.communication_style = hints.communication_style
      ? `${hints.communication_style}, tom encorajador`
      : "encorajador e acolhedor"
  } else if (bf.agreeableness < LOW) {
    hints.communication_style = hints.communication_style
      ? `${hints.communication_style}, tom direto`
      : "direto e objetivo"
  }

  // Neuroticism → challenge_level
  if (bf.neuroticism >= HIGH) {
    hints.challenge_level = "gradual com reforco positivo"
  } else if (bf.neuroticism < LOW) {
    hints.challenge_level = "desafiador e instigante"
  }

  return hints
}

// ---- DISC rules ----

function hintsFromDISC(disc: DISCInput): Partial<AdaptationHints> {
  const dominant = getDominantDISC(disc)

  switch (dominant) {
    case "D":
      return {
        communication_style: "direto e orientado a resultados",
        challenge_level: "alto com metas claras",
        pace_preference: "rapido e objetivo",
        examples_type: "cases de lideranca e estrategia",
      }
    case "I":
      return {
        communication_style: "entusiastico e colaborativo",
        challenge_level: "moderado com variedade",
        pace_preference: "dinamico com interacao",
        examples_type: "historias e cenarios sociais",
      }
    case "S":
      return {
        communication_style: "paciente e passo a passo",
        challenge_level: "gradual e consistente",
        pace_preference: "estavel e previsivel",
        examples_type: "exemplos detalhados e sequenciais",
      }
    case "C":
      return {
        communication_style: "analitico e fundamentado",
        challenge_level: "preciso com dados de suporte",
        pace_preference: "metodico e detalhado",
        examples_type: "dados, pesquisas e analises",
      }
  }
}

// ---- Main function ----

/**
 * Builds adaptation hints from a learner's Big Five and DISC profiles.
 *
 * Rules are applied in order: Big Five first, then DISC.
 * DISC overrides Big Five only when there's a conflict and DISC
 * has a strong dominant type (the highest score > 35% of total).
 *
 * If no assessment data is provided, returns neutral defaults.
 */
export function buildAdaptationHints(scores: ProfileScores): AdaptationHints {
  if (!scores.bigFive && !scores.disc) {
    return { ...NEUTRAL_HINTS }
  }

  // Start with neutral base
  const merged: AdaptationHints = { ...NEUTRAL_HINTS }

  // Layer 1: Big Five (broad personality)
  if (scores.bigFive) {
    const bfHints = hintsFromBigFive(scores.bigFive)
    Object.assign(merged, bfHints)
  }

  // Layer 2: DISC (behavioral style) — overrides where relevant
  if (scores.disc) {
    const total = scores.disc.d + scores.disc.i + scores.disc.s + scores.disc.c
    const dominant = getDominantDISC(scores.disc)
    const dominantScore = scores.disc[dominant.toLowerCase() as keyof DISCInput]

    // Only apply DISC overrides when there's a clear dominant type (>35% of total)
    if (total > 0 && dominantScore / total > 0.35) {
      const discHints = hintsFromDISC(scores.disc)
      Object.assign(merged, discHints)
    }
  }

  return merged
}
