/**
 * DISC type labels, descriptions, and combination logic.
 * All strings in Portuguese (PT-BR) without accented characters.
 */

import type { DISCResult } from "@/components/profile/scoring"

export const DISC_TYPE_NAMES: Record<string, string> = {
  D: "Dominante",
  I: "Influenciador",
  S: "Estável",
  C: "Consciencioso",
}

export const DISC_TYPE_DESCRIPTIONS: Record<string, { strengths: string; challenges: string }> = {
  D: {
    strengths:
      "Você é orientado a resultados, decidido e assertivo. Tem facilidade em tomar decisões rápidas, aceitar desafios e liderar em situações de pressão. Sua determinação inspira ação e progresso.",
    challenges:
      "Pode ser percebido como impaciente ou excessivamente direto. Em situações de estresse, tende a priorizar velocidade sobre detalhes. Desenvolver escuta ativa e paciência fortalece sua liderança.",
  },
  I: {
    strengths:
      "Você é entusiasta, comunicativo e otimista. Tem facilidade em construir relacionamentos, motivar equipes e criar ambientes colaborativos. Sua energia positiva gera engajamento.",
    challenges:
      "Pode ter dificuldade com tarefas detalhadas ou rotineiras. Em situações de estresse, tende a ser impulsivo ou perder o foco. Desenvolver disciplina e organização potencializa seus talentos.",
  },
  S: {
    strengths:
      "Você é paciente, confiável e cooperativo. Tem facilidade em manter harmonia, apoiar colegas e trabalhar com consistência. Sua estabilidade traz segurança para equipes.",
    challenges:
      "Pode ter dificuldade com mudanças rápidas ou conflitos. Em situações de estresse, tende a evitar confrontos necessários. Desenvolver assertividade e adaptabilidade amplia seu impacto.",
  },
  C: {
    strengths:
      "Você é analítico, preciso e detalhista. Tem facilidade em seguir procedimentos, garantir qualidade e tomar decisões baseadas em dados. Sua rigorosidade assegura excelência.",
    challenges:
      "Pode ser percebido como perfeccionista ou excessivamente cauteloso. Em situações de estresse, tende a se prender a detalhes. Desenvolver flexibilidade e tolerância ao risco amplia sua efetividade.",
  },
}

export const DISC_COMBO_LABELS: Record<string, string> = {
  DI: "DI — Líder Inspirador",
  DI_desc:
    "Combina determinação com habilidade de influenciar. Lidera com energia e foco em resultados, motivando equipes com entusiasmo.",
  DS: "DS — Líder Firme",
  DS_desc:
    "Combina assertividade com estabilidade. Toma decisões firmes mantendo o time seguro e apoiado.",
  DC: "DC — Estrategista Decisivo",
  DC_desc:
    "Combina orientação a resultados com precisão analítica. Toma decisões rápidas fundamentadas em dados.",
  ID: "ID — Influenciador Decisivo",
  ID_desc:
    "Combina carisma com determinação. Inspira ação através de comunicação persuasiva e foco em metas.",
  IS: "IS — Facilitador Harmonioso",
  IS_desc:
    "Combina sociabilidade com cooperação. Cria ambientes acolhedores onde todos se sentem valorizados.",
  IC: "IC — Comunicador Analítico",
  IC_desc:
    "Combina expressividade com precisão. Comunica ideias complexas de forma envolvente e fundamentada.",
  SD: "SD — Apoiador Determinado",
  SD_desc:
    "Combina paciência com firmeza. Oferece suporte consistente enquanto direciona para resultados concretos.",
  SI: "SI — Colaborador Entusiasta",
  SI_desc:
    "Combina estabilidade com otimismo. Mantém a equipe motivada em ambientes previsíveis e positivos.",
  SC: "SC — Analista Estável",
  SC_desc:
    "Combina consistência com atenção aos detalhes. Entrega trabalho de alta qualidade com previsibilidade.",
  CD: "CD — Perfeccionista Decidido",
  CD_desc:
    "Combina rigor analítico com assertividade. Busca excelência com determinação para implementar melhorias.",
  CI: "CI — Especialista Comunicativo",
  CI_desc:
    "Combina expertise técnica com habilidade social. Traduz complexidade em comunicação acessível.",
  CS: "CS — Guardião da Qualidade",
  CS_desc:
    "Combina precisão com cooperação. Garante padrões elevados em ambientes estáveis e bem estruturados.",
}

export interface DISCTypeInfo {
  dominant: string
  secondary: string
  label: string
  description: string
}

/**
 * Determines the dominant and secondary DISC types from scores.
 * Returns type names and the combination label.
 */
export function getDominantType(scores: DISCResult): DISCTypeInfo {
  const entries: Array<{ key: string; value: number }> = [
    { key: "D", value: scores.d },
    { key: "I", value: scores.i },
    { key: "S", value: scores.s },
    { key: "C", value: scores.c },
  ]

  entries.sort((a, b) => b.value - a.value)

  const dominant = entries[0].key
  const secondary = entries[1].key
  const comboKey = `${dominant}${secondary}`
  const label = DISC_COMBO_LABELS[comboKey] ?? `${dominant}${secondary}`
  const description = DISC_COMBO_LABELS[`${comboKey}_desc`] ?? ""

  return {
    dominant,
    secondary,
    label,
    description,
  }
}
