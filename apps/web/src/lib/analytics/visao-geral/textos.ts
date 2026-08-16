// ---------------------------------------------------------------------------
// Textos literais da Visão geral — §32 (estados vazios) e rótulos fixos.
// ---------------------------------------------------------------------------
// As quatro strings da §32 são LITERAIS da spec: acento, caixa e ponto final
// contam. Elas existem porque `0%` e "você ainda não acionou ninguém" são
// mensagens OPOSTAS a partir do mesmo dado ausente (I-3).
//
// Dois textos aqui NÃO estão na §32 e ficam marcados como tal: a spec cobre
// tendência, acionamentos, gargalos e sinais, mas não cobre "o recorte não tem
// ninguém" nem "ninguém iniciou a jornada" — e esses dois são estados REAIS em
// produção (um gestor sem time; um tenant recém-criado). Renderizar `0%` neles
// é a mesma mentira que a §32 proíbe, então eles ganham texto. A redação está
// pendente do aval do Senhor.
// ---------------------------------------------------------------------------

import type { MotivoAusencia } from "./tipos"

/** §32 — literal. */
export const VAZIO_TENDENCIA =
  "Precisamos de pelo menos dois períodos de atividade para identificar uma tendência."

/** §32 — literal. */
export const VAZIO_ACIONAMENTOS = "Você ainda não realizou acionamentos neste período."

/** §32 — literal. */
export const VAZIO_GARGALOS = "Nenhum gargalo relevante foi identificado neste período."

/** §32 — literal. */
export const VAZIO_SINAIS = "Nenhum sinal relevante fora do padrão foi identificado."

/** NÃO está na §32 — proposto. Aguarda aval do Senhor. */
export const VAZIO_SEM_ESCOPO = "Não há pessoas neste recorte."

/** NÃO está na §32 — proposto. Aguarda aval do Senhor. */
export const VAZIO_NINGUEM_INICIOU = "Ninguém iniciou a jornada neste recorte."

/** NÃO está na §32 — proposto. Aguarda aval do Senhor. */
export const VAZIO_SEM_PRAZO =
  "Nenhum curso deste recorte tem prazo definido, então não é possível comparar com o ritmo esperado."

/**
 * O que a tela diz quando a consulta falha. Note que NÃO é um estado vazio: é
 * o caminho de I-4. Um bloco em `erro` não pode renderizar numeral nenhum, ou
 * a falha de banco vira "fato" sobre a equipe.
 */
export const ERRO_LEITURA = "Não foi possível carregar este bloco agora."

export function textoDoMotivo(motivo: MotivoAusencia): string {
  switch (motivo) {
    case "sem-escopo":
      return VAZIO_SEM_ESCOPO
    case "sem-base":
      return VAZIO_NINGUEM_INICIOU
    case "sem-periodo-anterior":
    case "sem-historico-comparavel":
      return VAZIO_TENDENCIA
    case "sem-acionamentos":
      return VAZIO_ACIONAMENTOS
    case "sem-gargalos":
      return VAZIO_GARGALOS
    case "sem-sinais":
    case "sem-historico-suficiente":
      return VAZIO_SINAIS
    case "falha-de-leitura":
      return ERRO_LEITURA
  }
}

// --- Rótulos fixos ---------------------------------------------------------

/** §12 — texto obrigatório, renderizado, nunca tooltip (I-2). */
export const DISCLAIMER_CAUSALIDADE =
  "Resultado observado após o acionamento. Não representa comprovação causal."

/** Travessão U+2014. Nunca "0 dias", nunca string vazia (I-3 / C-24). */
export const TRAVESSAO = "—"

/**
 * "hoje" / "1 dia atrás" / "N dias atrás" / "—".
 * A ausência de atividade é o travessão, jamais "0 dias atrás".
 */
export function rotuloUltimaAtividade(dias: number | null): string {
  if (dias === null) return TRAVESSAO
  if (dias <= 0) return "hoje"
  if (dias === 1) return "1 dia atrás"
  return `${dias} dias atrás`
}

/** Vocabulário de apoio, nunca de cobrança (§2 Regra 2 / I-8). */
export const ROTULO_ESTADO: Record<string, string> = {
  sustentando: "Sustentando",
  "perdendo-ritmo": "Perdendo ritmo",
  parado: "Parado",
  retomando: "Retomando",
  concluido: "Concluído",
  "nao-iniciou": "Não iniciou",
}
