import type { KolbMode } from "./kolb-items"

export interface KolbResult {
  /** Raw scores per mode (sum of rankings 1-4 across 12 items) */
  ce: number
  ro: number
  ac: number
  ae: number
  /** Grasping axis: CE - AC (positive = concrete, negative = abstract) */
  graspingAxis: number
  /** Transforming axis: AE - RO (positive = active, negative = reflective) */
  transformingAxis: number
  /** Dominant learning style */
  style: "Divergente" | "Assimilador" | "Convergente" | "Acomodador"
  /** Style description */
  description: string
  /** Percentage confidence (0-100) based on axis magnitudes */
  confidence: number
}

const STYLE_DESCRIPTIONS: Record<string, string> = {
  Divergente:
    "Você aprende melhor combinando experiência concreta com observação reflexiva. Forte em gerar ideias, ver situações de múltiplas perspectivas e se conectar com pessoas. Destaca-se em brainstorming e trabalho colaborativo.",
  Assimilador:
    "Você aprende melhor combinando conceituação abstrata com observação reflexiva. Forte em criar modelos teóricos, raciocínio indutivo e planejamento. Destaca-se na organização lógica de informações.",
  Convergente:
    "Você aprende melhor combinando conceituação abstrata com experimentação ativa. Forte em aplicar teoria na prática, resolver problemas técnicos e tomar decisões. Destaca-se em encontrar soluções práticas.",
  Acomodador:
    "Você aprende melhor combinando experiência concreta com experimentação ativa. Forte em executar planos, assumir riscos e adaptar-se a novas situações. Destaca-se em implementação e liderança de ação.",
}

/**
 * Score Kolb assessment from ranked answers.
 * Each item has 4 options ranked 1-4 (1=least like me, 4=most like me).
 * answers: { itemId: { ce: rank, ro: rank, ac: rank, ae: rank } }
 */
export function scoreKolb(
  answers: Record<number, Record<KolbMode, number>>,
): KolbResult {
  let ce = 0
  let ro = 0
  let ac = 0
  let ae = 0

  for (const ranks of Object.values(answers)) {
    ce += ranks.ce ?? 0
    ro += ranks.ro ?? 0
    ac += ranks.ac ?? 0
    ae += ranks.ae ?? 0
  }

  const graspingAxis = ce - ac // positive = concrete preference
  const transformingAxis = ae - ro // positive = active preference

  let style: KolbResult["style"]
  if (graspingAxis >= 0 && transformingAxis < 0) style = "Divergente"
  else if (graspingAxis < 0 && transformingAxis < 0) style = "Assimilador"
  else if (graspingAxis < 0 && transformingAxis >= 0) style = "Convergente"
  else style = "Acomodador"

  // Confidence based on how far from the center (0,0) the point is
  const maxAxis = 12 * 3 // theoretical max (all 4s vs all 1s across 12 items)
  const magnitude = Math.sqrt(graspingAxis ** 2 + transformingAxis ** 2)
  const confidence = Math.min(100, Math.round((magnitude / maxAxis) * 100))

  return {
    ce,
    ro,
    ac,
    ae,
    graspingAxis,
    transformingAxis,
    style,
    description: STYLE_DESCRIPTIONS[style],
    confidence,
  }
}
