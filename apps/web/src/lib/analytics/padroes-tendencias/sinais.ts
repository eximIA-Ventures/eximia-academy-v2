// ---------------------------------------------------------------------------
// §18 — "Sinais emergentes". Máximo 3, e um sinal precisa se REPETIR.
// ---------------------------------------------------------------------------
// A §18 admite duas portas: recorrência ("≥2 períodos consecutivos") ou limiar
// configurado. As duas estão aqui, e a de recorrência vem primeiro na ordenação
// — um padrão que se repete vale mais que uma oscilação isolada, e é essa a
// diferença entre esta tela e a Visão geral (§14: "tempo + recorrência +
// tendência", não estado atual).
//
// BASE MÍNIMA NA RECORRÊNCIA (3 pessoas três semanas atrás) não é detalhe: sem
// ela, a série 2 → 1 → 0 de um capítulo pouco visitado vira "queda recorrente"
// e o gestor recebe um alarme de duas pessoas. Alarme falso gasta exatamente a
// atenção que a tela existe para economizar.
//
// O NÚMERO DA REGULARIDADE É UM SÓ. Este bloco, o §16 e o §20 leem a MESMA
// estrutura `base.regularidade`, produzida uma vez em `base.ts`. Três lugares
// da tela mostrando três valores para a mesma coisa é o defeito clássico, e a
// única defesa é não haver três cálculos.
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DOS_SINAIS, primeiraFalha } from "./fonte"
import {
  MODULO_BASE_MIN,
  RECORRENCIA_MIN_SEMANAS,
  REGULARIDADE_DELTA_MIN_PESSOAS,
  REGULARIDADE_DELTA_MIN_PP,
  SINAIS_MAX,
} from "./parametros"
import {
  ACAO_SINAIS,
  SUBTITULO_SINAIS,
  TITULO_SINAIS,
  VAZIO_SEM_ESCOPO,
  VAZIO_SINAIS,
} from "./textos"
import type { Acao, BlocoSinais, ComEstado, ItemSinal } from "./tipos"

const ACAO: Acao = { id: "sinais", rotulo: ACAO_SINAIS, ctaEscreve: false }

export const BADGE_RECORRENTE = "Padrão recorrente"
export const BADGE_ALTA = "Tendência de alta"
export const BADGE_QUEDA = "Tendência de queda"

export interface Recorrencia {
  /** Quantas diferenças consecutivas não crescentes, contadas do fim. */
  semanas: number
  /** Pessoas a menos entre o início da sequência e a última semana. */
  queda: number
}

/**
 * A série de um módulo está em queda recorrente?
 *
 * Exige: as `RECORRENCIA_MIN_SEMANAS` últimas diferenças ≤ 0, ao menos uma
 * < 0, e base ≥ `MODULO_BASE_MIN` no ponto de partida da sequência.
 * `8,6,4` → sim (2 semanas). `8,6,7` → não (a última diferença sobe).
 * `2,1,0` → não (base 2, abaixo do mínimo).
 */
export function quedaRecorrente(serie: readonly number[]): Recorrencia | null {
  const n = serie.length
  if (n < RECORRENCIA_MIN_SEMANAS + 1) return null

  let passos = 0
  let houveQueda = false
  for (let i = n - 1; i >= 1; i--) {
    const diferenca = (serie[i] ?? 0) - (serie[i - 1] ?? 0)
    if (diferenca > 0) break
    if (diferenca < 0) houveQueda = true
    passos++
  }
  if (passos < RECORRENCIA_MIN_SEMANAS || !houveQueda) return null

  const partida = serie[n - 1 - passos] ?? 0
  if (partida < MODULO_BASE_MIN) return null

  return { semanas: passos, queda: partida - (serie[n - 1] ?? 0) }
}

interface Candidato {
  item: Omit<ItemSinal, "ordem">
  ordemDoTipo: number
}

export function montarSinais(base: BasePadroes, falhas: FalhasPorFonte): ComEstado<BlocoSinais> {
  const cabeca = { titulo: TITULO_SINAIS, subtitulo: SUBTITULO_SINAIS, acao: ACAO }

  const falha = primeiraFalha(falhas, FONTES_DOS_SINAIS)
  if (falha) {
    return {
      ...cabeca,
      itens: [],
      textoComplementar: null,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.visao.roster.size === 0) {
    return {
      ...cabeca,
      itens: [],
      textoComplementar: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const candidatos: Candidato[] = []

  // --- porta 1: recorrência por módulo ------------------------------------
  for (const serie of base.seriesPorModulo) {
    const recorrencia = quedaRecorrente(serie.ativosPorSemana)
    if (recorrencia === null) continue
    candidatos.push({
      ordemDoTipo: 1,
      item: {
        id: `recorrencia:${serie.capituloId}`,
        tipo: "recorrencia",
        titulo: "Desaceleração recorrente em um módulo",
        descricao: `${serie.titulo} apresenta queda há ${recorrencia.semanas} semanas`,
        badgeRotulo: BADGE_RECORRENTE,
        badgeTom: "amber",
        icone: "trending-down",
        pessoas: recorrencia.queda,
      },
    })
  }

  // --- porta 2: limiar de regularidade ------------------------------------
  const { deltaPp, deltaPessoas } = base.regularidade
  if (
    deltaPp !== null &&
    deltaPessoas !== null &&
    Math.abs(deltaPp) >= REGULARIDADE_DELTA_MIN_PP &&
    Math.abs(deltaPessoas) >= REGULARIDADE_DELTA_MIN_PESSOAS
  ) {
    const caiu = deltaPp < 0
    candidatos.push({
      ordemDoTipo: 2,
      item: {
        id: "limiar:regularidade",
        tipo: "limiar",
        titulo: caiu ? "Menor regularidade de estudos" : "Maior regularidade de estudos",
        descricao: `${caiu ? "Redução" : "Aumento"} de ${Math.abs(deltaPp)} p.p. em alunos que estudam 2x ou mais por semana`,
        badgeRotulo: caiu ? BADGE_QUEDA : BADGE_ALTA,
        badgeTom: caiu ? "red" : "green",
        icone: caiu ? "user-minus" : "user-plus",
        pessoas: Math.abs(deltaPessoas),
      },
    })
  }

  if (candidatos.length === 0) {
    // Silêncio EXPLICADO. "Nenhum sinal" pode ser time saudável ou dois terços
    // do recorte sem histórico comparável — são mensagens diferentes.
    const semHistorico = base.semHistoricoComparavel
    return {
      ...cabeca,
      itens: [],
      textoComplementar:
        semHistorico > 0
          ? `${semHistorico} de ${base.visao.roster.size} pessoas do recorte ainda não têm histórico suficiente para comparação.`
          : null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SINAIS,
      motivoVazio: "sem-sinais",
    }
  }

  const ordenados = [...candidatos].sort(
    (a, b) => a.ordemDoTipo - b.ordemDoTipo || b.item.pessoas - a.item.pessoas,
  )

  return {
    ...cabeca,
    itens: ordenados.slice(0, SINAIS_MAX).map((c, i): ItemSinal => ({ ...c.item, ordem: i + 1 })),
    textoComplementar: null,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
