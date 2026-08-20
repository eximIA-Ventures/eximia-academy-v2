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

import { pluralDe } from "../_comum/texto"
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
  /** Pessoas ativas no início da sequência. Um dos DOIS LADOS da frase (D-2). */
  partida: number
  /** Pessoas ativas na última semana. O outro lado. */
  chegada: number
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

  const chegada = serie[n - 1] ?? 0
  return { semanas: passos, queda: partida - chegada, partida, chegada }
}

interface Candidato {
  item: Omit<ItemSinal, "ordem">
  ordemDoTipo: number
}

/**
 * O denominador da verificação, com os DOIS eixos de concordância separados.
 *
 * O substantivo segue o TOTAL (o conjunto de onde se conta); o verbo segue o
 * NUMERADOR (o sujeito da oração). "1 de 9 pessoas do recorte ainda não têm"
 * estava errado no verbo, e o plural fixo só não aparecia porque a fixture rica
 * nunca produziu numerador 1 — a base real produz.
 */
function textoDeCobertura(semHistorico: number, total: number): string {
  const substantivo = pluralDe(total, "pessoa do recorte", "pessoas do recorte")
  const verbo = semHistorico <= 1 ? "ainda não tem" : "ainda não têm"
  return `${semHistorico} de ${total} ${substantivo} ${verbo} histórico suficiente para comparação.`
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
        // ═══ DIVERGÊNCIA REGISTRADA (doutrina do texto, 2026-08-19) ═════════
        // A lente pediu o módulo NO TÍTULO ("nomeia 'um módulo' quando a linha
        // seguinte diz qual, e o título é a linha mais cara do card"). NÃO foi
        // feito, e a razão é medida, não preguiça: o card tem 220px úteis e
        // este título já pede 217px de tinta (medição registrada em
        // `components/analytics/padroes-tendencias/padroes-tendencias-tab.tsx`).
        // Interpolar o nome do módulo aqui quebra o título em duas linhas — que
        // é exatamente o que a referência aprovada NÃO faz. O módulo continua
        // na descrição, onde já estava e onde cabe.
        titulo: "Desaceleração recorrente em um módulo",
        // OS DOIS LADOS, não só a duração. "apresenta queda há 2 semanas" diz
        // que caiu e esconde de quanto para quanto — e é a magnitude que decide
        // se o gestor marca uma sessão sobre o módulo ou deixa correr.
        descricao: `${serie.titulo}: de ${recorrencia.partida} para ${recorrencia.chegada} ${pluralDe(recorrencia.partida, "pessoa ativa", "pessoas ativas")} em ${recorrencia.semanas} semanas.`,
        badgeRotulo: BADGE_RECORRENTE,
        badgeTom: "amber",
        icone: "trending-down",
        pessoas: recorrencia.queda,
      },
    })
  }

  // --- porta 2: limiar de regularidade ------------------------------------
  const { deltaPp, deltaPessoas, regularesAtual, regularesAnterior, denominador } =
    base.regularidade
  if (
    deltaPp !== null &&
    deltaPessoas !== null &&
    regularesAnterior !== null &&
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
        // ═══ D-1 · O MESMO NÚMERO NÃO SAI DE TRÊS CARDS DA MESMA ABA ════════
        // Este bloco, o §16 ("Principais mudanças") e o §20 ("Participação")
        // leem a MESMA `base.regularidade` — e até aqui os três publicavam o
        // MESMO `p.p.`, com os mesmos limiares importados dos mesmos arquivos.
        // Ler uma fonte só resolvia a divergência; não resolvia a repetição.
        // O gestor lia o terceiro e concluía que a tela estava enrolando.
        //
        // A saída não é calar o sinal, é ele dizer o que os outros dois NÃO
        // dizem: os dois lados em PESSOAS, com o denominador. Em base pequena
        // essa é a forma útil de qualquer proporção — "6 p.p." num recorte de 6
        // pessoas é uma pessoa, e o ponto percentual esconde isso.
        descricao: `De ${regularesAnterior} para ${regularesAtual} de ${denominador} ${pluralDe(denominador, "pessoa", "pessoas")} estudando 2x ou mais por semana.`,
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
        semHistorico > 0 ? textoDeCobertura(semHistorico, base.visao.roster.size) : null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SINAIS,
      motivoVazio: "sem-sinais",
    }
  }

  const ordenados = [...candidatos].sort(
    (a, b) => a.ordemDoTipo - b.ordemDoTipo || b.item.pessoas - a.item.pessoas,
  )
  const itens = ordenados
    .slice(0, SINAIS_MAX)
    .map((c, i): ItemSinal => ({ ...c.item, ordem: i + 1 }))

  // SILÊNCIO PARCIAL TAMBÉM É SILÊNCIO. O bloco vazio já explica por que não
  // falou (acima). Faltava o caso do meio: quando o bloco fala MENOS do que
  // poderia, o espaço que sobra é lido como "não há mais nada acontecendo" —
  // e pode ser, ao contrário, que boa parte do recorte não tenha janela
  // anterior com que se comparar. São mensagens diferentes, e a segunda só
  // existe se estiver escrita. Com o bloco cheio (`SINAIS_MAX`) o complemento
  // some: aí o corte é do teto, não da base, e a frase enganaria.
  //
  // A MESMA frase, pelo MESMO helper. Esta cópia nasceu interpolada à mão e com
  // o plural preso no literal: emitia "1 de 10 pessoas do recorte ainda não têm"
  // sempre que o bloco falava e sobrava espaço. Duas escritas do mesmo texto é a
  // família de defeito que esta camada combate em todo lugar — só que aqui o
  // segundo caminho não divergiu num número, divergiu na CONCORDÂNCIA, que é
  // mais barata de ignorar e igualmente lida por quem usa a tela.
  const semHistorico = base.semHistoricoComparavel
  const textoComplementar =
    itens.length < SINAIS_MAX && semHistorico > 0
      ? textoDeCobertura(semHistorico, base.visao.roster.size)
      : null

  return {
    ...cabeca,
    itens,
    textoComplementar,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
