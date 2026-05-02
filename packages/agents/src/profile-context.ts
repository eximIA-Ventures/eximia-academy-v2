import type { ExistingLearnerProfile } from "./shadow-pipeline"

/**
 * Sanitize a free-text profile field to prevent prompt injection.
 * Removes control characters, HTML tags, and enforces length limits.
 */
export function sanitizeProfileForPrompt(value: string | null | undefined, maxLen = 200): string | null {
  if (!value) return null
  return value
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[#{}[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, maxLen) || null
}

/**
 * Kolb style tips mapping — what type of question works best per style.
 */
const KOLB_ADAPTATION: Record<string, { preferredQuestions: string; examples: string }> = {
  divergente: {
    preferredQuestions: "perspectiva, conexão pessoal",
    examples: "\"Como isso se conecta com sua experiencia?\", \"Que outra forma de ver isso existe?\"",
  },
  assimilador: {
    preferredQuestions: "evidencia, frameworks",
    examples: "\"Que principio explica isso?\", \"Como isso se encaixa no modelo?\"",
  },
  convergente: {
    preferredQuestions: "aplicação pratica, problema",
    examples: "\"Como você resolveria isso na pratica?\", \"Qual a abordagem mais eficiente?\"",
  },
  acomodador: {
    preferredQuestions: "acao, experimentacao",
    examples: "\"O que você tentaria primeiro?\", \"O que aprendeu com essa experiencia?\"",
  },
}

/**
 * Build the learner profile context section for the Mestre prompt.
 * This injects Kolb profile and Perfilador adaptation hints.
 * Returns empty string if no profile data available.
 */
export function buildLearnerProfileContext(profile: ExistingLearnerProfile | null): string {
  if (!profile) return ""

  const lines: string[] = []

  // Kolb profile
  if (profile.kolb_dominant_style) {
    const style = profile.kolb_dominant_style
    const confidencePercent = Math.round((profile.kolb_style_confidence ?? 0) * 100)
    const kolbTip = KOLB_ADAPTATION[style]

    lines.push(`Estilo Kolb: ${style} (confianca: ${confidencePercent}%)`)
    if (kolbTip) {
      lines.push(`  → Prefere perguntas de: ${kolbTip.preferredQuestions}`)
      lines.push(`  → Exemplos: ${kolbTip.examples}`)
    }
  }

  // Engagement style
  if (profile.engagement_style) {
    const styleTips: Record<string, string> = {
      reflective: "Aluno reflexivo — de tempo para pensar, não pressione por respostas rápidas",
      impulsive: "Aluno impulsivo — peca para elaborar e justificar antes de responder",
      balanced: "Estilo balanceado — alterne entre reflexão e acao",
    }
    const tip = styleTips[profile.engagement_style]
    if (tip) lines.push(tip)
  }

  // Adaptation hints from Perfilador
  if (profile.adaptation_hints.length > 0) {
    for (const hint of profile.adaptation_hints.slice(0, 5)) {
      const sanitized = sanitizeProfileForPrompt(hint)
      if (sanitized) lines.push(sanitized)
    }
  }

  // Preferred question types
  if (profile.preferred_question_types.length > 0) {
    lines.push(`Tipos de pergunta que funcionam melhor: ${profile.preferred_question_types.join(", ")}`)
  }

  // Strengths (for positive reinforcement)
  if (profile.strengths.length > 0) {
    const sanitizedStrengths = profile.strengths
      .slice(0, 3)
      .map((s) => sanitizeProfileForPrompt(s))
      .filter(Boolean)
    if (sanitizedStrengths.length > 0) {
      lines.push(`Pontos fortes do aluno: ${sanitizedStrengths.join(", ")}`)
    }
  }

  // Growth areas (for targeted challenge)
  if (profile.growth_areas.length > 0) {
    const sanitizedGrowth = profile.growth_areas
      .slice(0, 3)
      .map((s) => sanitizeProfileForPrompt(s))
      .filter(Boolean)
    if (sanitizedGrowth.length > 0) {
      lines.push(`Areas de crescimento: ${sanitizedGrowth.join(", ")}`)
    }
  }

  if (lines.length === 0) return ""

  return `\n## PERFIL DO ALUNO (use para adaptar suas perguntas)\n${lines.join("\n")}\n`
}
