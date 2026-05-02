/**
 * Scoring logic for the 44-item IPIP-NEO Big Five inventory.
 * Handles reversed items and normalizes to 0-100 scale.
 */

import { BIG_FIVE_ITEMS, type BigFiveDimension } from "./big-five-items"

export interface BigFiveScores {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

/**
 * Score the 44-item Big Five inventory.
 *
 * @param answers - Map of item id to Likert response (1-5)
 * @returns Scores per dimension normalized to 0-100
 */
export function scoreBigFive44(answers: Record<number, number>): BigFiveScores {
  const dimensions: BigFiveDimension[] = [
    "openness",
    "conscientiousness",
    "extraversion",
    "agreeableness",
    "neuroticism",
  ]

  const computeNormalized = (dimension: BigFiveDimension): number => {
    const items = BIG_FIVE_ITEMS.filter((item) => item.dimension === dimension)
    const scores = items.map((item) => {
      const raw = answers[item.id]
      if (raw === undefined) return 3 // neutral default
      const clamped = Math.max(1, Math.min(5, raw))
      return item.reversed ? 6 - clamped : clamped
    })

    // Average is in range [1, 5]. Normalize to [0, 100].
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return Math.round(((avg - 1) / 4) * 100)
  }

  const result: Record<string, number> = {}
  for (const dim of dimensions) {
    result[dim] = computeNormalized(dim)
  }

  return result as unknown as BigFiveScores
}

/**
 * Returns a Portuguese description for a given dimension and score (0-100).
 */
export function getDimensionDescription(dimension: BigFiveDimension, score: number): string {
  const descriptions: Record<BigFiveDimension, { high: string; medium: string; low: string }> = {
    openness: {
      high: "Você possui alta curiosidade intelectual, criatividade e abertura a novas experiencias. Tende a buscar novidades e apreciar a arte, ideias incomuns e variedade.",
      medium:
        "Você equilibra praticidade com curiosidade. Aceita novas experiencias, mas tambem valoriza abordagens tradicionais quando fazem sentido.",
      low: "Você prefere o familiar e o convencional. Tende a ser pratico, direto e valoriza a estabilidade em vez da novidade.",
    },
    conscientiousness: {
      high: "Você e organizado, disciplinado e orientado a objetivos. Tende a planejar com antecedencia e cumprir prazos de forma consistente.",
      medium:
        "Você consegue ser organizado quando necessario, mas tambem se permite flexibilidade. Equilibra planejamento com espontaneidade.",
      low: "Você tende a ser mais flexivel e espontaneo na abordagem das tarefas. Pode preferir liberdade em vez de estrutura rigida.",
    },
    extraversion: {
      high: "Você e sociavel, energico e busca estimulacao em interacoes sociais. Sente-se energizado pela companhia de outras pessoas.",
      medium:
        "Você aprecia tanto momentos sociais quanto momentos de solitude. Adapta-se bem a diferentes contextos de interacao.",
      low: "Você tende a ser mais reservado e introspectivo. Prefere interacoes em grupos menores e valoriza tempo a sos para recarregar energias.",
    },
    agreeableness: {
      high: "Você e cooperativo, empatico e considerado com os outros. Tende a confiar nas pessoas e buscar harmonia nos relacionamentos.",
      medium:
        "Você equilibra cooperacao com assertividade. Sabe ser empatico, mas tambem defende suas posicoes quando necessario.",
      low: "Você tende a ser mais analitico e competitivo nas interacoes. Prioriza objetividade e pode questionar as intencoes dos outros.",
    },
    neuroticism: {
      high: "Você tende a experimentar emocoes intensas e pode ser mais sensivel ao estresse. Consciencia emocional elevada pode ser canalizada como ferramenta de autoconhecimento.",
      medium:
        "Você tem uma estabilidade emocional moderada. Experimenta altos e baixos, mas geralmente consegue gerenciar suas emocoes de forma eficaz.",
      low: "Você e emocionalmente estavel e resiliente. Tende a lidar com situacoes estressantes de forma calma e equilibrada.",
    },
  }

  const levels = descriptions[dimension]
  if (score >= 67) return levels.high
  if (score >= 34) return levels.medium
  return levels.low
}
