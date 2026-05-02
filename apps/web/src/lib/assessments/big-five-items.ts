/**
 * IPIP-NEO Big Five 44-item inventory (public domain).
 * Items in Portuguese (PT-BR) without accented characters in strings.
 * Includes the original 20 items from scoring.ts plus 24 additional items.
 */

export type BigFiveDimension =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism"

export interface BigFiveItem {
  id: number
  text: string
  dimension: BigFiveDimension
  reversed: boolean
}

export const BIG_FIVE_ITEMS: BigFiveItem[] = [
  // ─── Extraversion (9 items: 5 positive, 4 reversed) ───────────────────
  { id: 1, text: "Sou a alma da festa", dimension: "extraversion", reversed: false },
  { id: 2, text: "Nao falo muito", dimension: "extraversion", reversed: true },
  {
    id: 3,
    text: "Me sinto confortavel perto de pessoas",
    dimension: "extraversion",
    reversed: false,
  },
  { id: 4, text: "Fico em segundo plano", dimension: "extraversion", reversed: true },
  { id: 5, text: "Inicio conversas com facilidade", dimension: "extraversion", reversed: false },
  { id: 6, text: "Tenho pouco a dizer", dimension: "extraversion", reversed: true },
  { id: 7, text: "Gosto de ser o centro das atencoes", dimension: "extraversion", reversed: false },
  { id: 8, text: "Sou reservado em reunioes sociais", dimension: "extraversion", reversed: true },
  {
    id: 9,
    text: "Converso com muitas pessoas diferentes em festas",
    dimension: "extraversion",
    reversed: false,
  },

  // ─── Agreeableness (9 items: 5 positive, 4 reversed) ──────────────────
  {
    id: 10,
    text: "Me interesso pelos problemas dos outros",
    dimension: "agreeableness",
    reversed: false,
  },
  { id: 11, text: "Me interesso pouco pelos outros", dimension: "agreeableness", reversed: true },
  { id: 12, text: "Tenho um coracao mole", dimension: "agreeableness", reversed: false },
  {
    id: 13,
    text: "Nao me interesso muito pelos outros",
    dimension: "agreeableness",
    reversed: true,
  },
  {
    id: 14,
    text: "Dedico tempo para ajudar os outros",
    dimension: "agreeableness",
    reversed: false,
  },
  {
    id: 15,
    text: "Sinto as emocoes das outras pessoas",
    dimension: "agreeableness",
    reversed: false,
  },
  {
    id: 16,
    text: "Faco as pessoas se sentirem a vontade",
    dimension: "agreeableness",
    reversed: false,
  },
  { id: 17, text: "Insulto as pessoas", dimension: "agreeableness", reversed: true },
  {
    id: 18,
    text: "Nao estou realmente interessado nos outros",
    dimension: "agreeableness",
    reversed: true,
  },

  // ─── Conscientiousness (9 items: 5 positive, 4 reversed) ──────────────
  { id: 19, text: "Estou sempre preparado", dimension: "conscientiousness", reversed: false },
  { id: 20, text: "Deixo minhas coisas largadas", dimension: "conscientiousness", reversed: true },
  { id: 21, text: "Presto atencao nos detalhes", dimension: "conscientiousness", reversed: false },
  { id: 22, text: "Faco bagunca nas coisas", dimension: "conscientiousness", reversed: true },
  {
    id: 23,
    text: "Realizo minhas tarefas imediatamente",
    dimension: "conscientiousness",
    reversed: false,
  },
  {
    id: 24,
    text: "Frequentemente esqueco de colocar as coisas no lugar",
    dimension: "conscientiousness",
    reversed: true,
  },
  { id: 25, text: "Gosto de ordem", dimension: "conscientiousness", reversed: false },
  {
    id: 26,
    text: "Fujo das minhas responsabilidades",
    dimension: "conscientiousness",
    reversed: true,
  },
  { id: 27, text: "Sigo um cronograma", dimension: "conscientiousness", reversed: false },

  // ─── Neuroticism (9 items: 5 positive, 4 reversed) ────────────────────
  { id: 28, text: "Fico estressado facilmente", dimension: "neuroticism", reversed: false },
  {
    id: 29,
    text: "Sou relaxado na maior parte do tempo",
    dimension: "neuroticism",
    reversed: true,
  },
  { id: 30, text: "Me preocupo com as coisas", dimension: "neuroticism", reversed: false },
  { id: 31, text: "Raramente me sinto triste", dimension: "neuroticism", reversed: true },
  { id: 32, text: "Fico perturbado facilmente", dimension: "neuroticism", reversed: false },
  { id: 33, text: "Mudo de humor com frequencia", dimension: "neuroticism", reversed: false },
  { id: 34, text: "Fico irritado facilmente", dimension: "neuroticism", reversed: false },
  { id: 35, text: "Raramente me sinto ansioso", dimension: "neuroticism", reversed: true },
  {
    id: 36,
    text: "Frequentemente me sinto melancolico",
    dimension: "neuroticism",
    reversed: false,
  },

  // ─── Openness (8 items: 5 positive, 3 reversed) ───────────────────────
  { id: 37, text: "Tenho uma imaginacao rica", dimension: "openness", reversed: false },
  { id: 38, text: "Nao tenho muita imaginacao", dimension: "openness", reversed: true },
  { id: 39, text: "Tenho ideias excelentes", dimension: "openness", reversed: false },
  { id: 40, text: "Nao me interesso por ideias abstratas", dimension: "openness", reversed: true },
  {
    id: 41,
    text: "Tenho dificuldade em entender ideias abstratas",
    dimension: "openness",
    reversed: true,
  },
  { id: 42, text: "Gosto de pensar e brincar com ideias", dimension: "openness", reversed: false },
  { id: 43, text: "Tenho vocabulario rico", dimension: "openness", reversed: false },
  { id: 44, text: "Sou cheio de ideias", dimension: "openness", reversed: false },
]

export const BIG_FIVE_DIMENSION_LABELS: Record<BigFiveDimension, string> = {
  openness: "Abertura a Experiencias",
  conscientiousness: "Conscienciosidade",
  extraversion: "Extroversao",
  agreeableness: "Amabilidade",
  neuroticism: "Neuroticismo",
}
