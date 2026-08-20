// ---------------------------------------------------------------------------
// §20 — "Participação ao longo do tempo". Uma PARTIÇÃO, não quatro contagens.
// ---------------------------------------------------------------------------
// As quatro faixas saem de uma cascata mutuamente exclusiva avaliada em
// `base.ts` nesta ordem: sem atividade → 2x+ → 1x → irregular. Logo a soma das
// quatro é o `roster` POR CONSTRUÇÃO, e não por conferência posterior — quem
// não foi medido não some do denominador, aparece em "Sem atividade" (lição 4).
//
// PERCENTUAIS PELO MÉTODO DO MAIOR RESTO. Arredondar cada faixa isoladamente
// produz 101% com frequência, e a barra empilhada estoura o trilho. O maior
// resto garante soma exata de 100 sem mentir sobre nenhuma faixa em mais de um
// ponto percentual.
//
// O DENOMINADOR É RENDERIZADO. "Base: N pessoas do recorte." é texto na tela,
// nunca `title` de hover (I-2): régua que só existe no hover é régua que
// ninguém encontra — e esta tela divide por `roster` enquanto a Visão geral
// divide o indicador dela por `iniciados`.
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DA_PARTICIPACAO, primeiraFalha } from "./fonte"
import { REGULARIDADE_DELTA_MIN_PESSOAS, REGULARIDADE_DELTA_MIN_PP } from "./parametros"
import {
  ACAO_PARTICIPACAO,
  ROTULO_FAIXA,
  SEM_COMPARACAO_REGULARIDADE,
  SUBTITULO_PARTICIPACAO,
  TITULO_PARTICIPACAO,
  VAZIO_PARTICIPACAO,
  VAZIO_SEM_ESCOPO,
  textoDenominador,
} from "./textos"
import type { Acao, BlocoParticipacao, ComEstado, FaixaParticipacao, IdFaixa, Tom } from "./tipos"

const ACAO: Acao = { id: "participacao", rotulo: ACAO_PARTICIPACAO, ctaEscreve: false }

const TOM_DA_FAIXA: Record<IdFaixa, Tom> = {
  "2x-ou-mais": "green",
  "1x": "amber",
  irregular: "amber",
  "sem-atividade": "red",
}

/**
 * Percentuais inteiros que somam EXATAMENTE 100 (maior resto).
 *
 * Com denominador 0 devolve zeros — mas esse caso nunca chega à tela: o bloco
 * já saiu em estado vazio antes.
 */
export function percentuaisMaiorResto(valores: readonly number[], total: number): number[] {
  if (total <= 0) return valores.map(() => 0)
  const exatos = valores.map((v) => (v / total) * 100)
  const pisos = exatos.map((v) => Math.floor(v))
  let sobra = 100 - pisos.reduce((s, v) => s + v, 0)
  const ordem = exatos
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
  const saida = [...pisos]
  for (const { i } of ordem) {
    if (sobra <= 0) break
    saida[i] = (saida[i] ?? 0) + 1
    sobra--
  }
  return saida
}

/** §20 rodapé: a frase da variação, ou a admissão de que não há comparação. */
export function fraseDaRegularidade(deltaPp: number | null, deltaPessoas: number | null): string {
  if (
    deltaPp === null ||
    deltaPessoas === null ||
    Math.abs(deltaPp) < REGULARIDADE_DELTA_MIN_PP ||
    Math.abs(deltaPessoas) < REGULARIDADE_DELTA_MIN_PESSOAS
  ) {
    // NUNCA "a regularidade está estável": o que existe é ausência de
    // comparação, e as duas afirmações não são a mesma coisa.
    return SEM_COMPARACAO_REGULARIDADE
  }
  const verbo = deltaPp < 0 ? "caiu" : "subiu"
  return `A regularidade ${verbo} ${Math.abs(deltaPp)} p.p. no período.`
}

export function montarParticipacao(
  base: BasePadroes,
  falhas: FalhasPorFonte,
): ComEstado<BlocoParticipacao> {
  const cabeca = {
    titulo: TITULO_PARTICIPACAO,
    subtitulo: SUBTITULO_PARTICIPACAO,
    acao: ACAO,
  }
  const vazio = {
    ...cabeca,
    faixas: [],
    textoDenominador: textoDenominador(base.visao.roster.size),
    frase: SEM_COMPARACAO_REGULARIDADE,
    deltaPp: null,
  }

  const falha = primeiraFalha(falhas, FONTES_DA_PARTICIPACAO)
  if (falha) {
    return {
      ...vazio,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.visao.roster.size === 0) {
    return {
      ...vazio,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const { regulares, umaVez, irregulares, semAtividade } = base.participacao
  const contagens = [regulares.length, umaVez.length, irregulares.length, semAtividade.length]

  // Recorte inteiro sem um carimbo sequer: quatro faixas com "0%" e uma barra
  // vazia comunicariam medição; o que há é ausência de atividade.
  if (contagens[3] === base.visao.roster.size) {
    return {
      ...vazio,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_PARTICIPACAO,
      motivoVazio: "sem-base",
    }
  }

  const ids: readonly IdFaixa[] = ["2x-ou-mais", "1x", "irregular", "sem-atividade"]
  const percentuais = percentuaisMaiorResto(contagens, base.visao.roster.size)
  const faixas: FaixaParticipacao[] = ids.map((id, i) => ({
    id,
    rotulo: ROTULO_FAIXA[id],
    pessoas: contagens[i] ?? 0,
    percentual: percentuais[i] ?? 0,
    tom: TOM_DA_FAIXA[id],
  }))

  return {
    ...cabeca,
    faixas,
    textoDenominador: textoDenominador(base.visao.roster.size),
    frase: fraseDaRegularidade(base.regularidade.deltaPp, base.regularidade.deltaPessoas),
    deltaPp: base.regularidade.deltaPp,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
