// ---------------------------------------------------------------------------
// §19 — "Onde o ritmo caiu mais". Máximo 4 MÓDULOS.
// ---------------------------------------------------------------------------
// I-8 tem tratamento explícito aqui, porque este é o bloco mais fácil de
// escorregar: a numeração 1..4 ordena MÓDULOS, objetos coletivos de currículo,
// nunca pessoas. Nenhum item deste bloco carrega id de aluno, nome ou inicial —
// o tipo `ItemGargalo` não tem onde guardar isso. É a diferença entre "onde o
// conteúdo trava" e "quem está devendo".
//
// DECISÃO REGISTRADA: a §19 diz "ativação OU conclusão". Aqui é ATIVAÇÃO POR
// SESSÃO. Conclusão exigiria `sessions.status` (não lido pela fonte reusada) ou
// `chapter_view_progress` — tabela criada em 2026-07-30, com script de
// backfill: numa janela de 30 dias medida hoje, o período anterior é ANTERIOR à
// tabela, e a comparação fabricaria crescimento. Medir o que a fonte sustenta é
// preferível a medir o que o rótulo promete.
//
// BASE MÍNIMA: só entram capítulos com ≥3 pessoas no período anterior. Com uma
// pessoa, alguém sair vira "−100%".
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DOS_GARGALOS, primeiraFalha } from "./fonte"
import { BARRA_FRACAO_PISO, GARGALOS_MAX } from "./parametros"
import {
  ACAO_GARGALOS,
  SUBTITULO_GARGALOS,
  TITULO_GARGALOS,
  VAZIO_GARGALOS,
  VAZIO_SEM_ESCOPO,
  percentualComSinal,
} from "./textos"
import type { Acao, BlocoGargalos, ComEstado, ItemGargalo } from "./tipos"

const ACAO: Acao = { id: "gargalos", rotulo: ACAO_GARGALOS, ctaEscreve: false }

/**
 * Comprimento da barra, com PISO.
 *
 * Sem o piso, uma queda de 8% ao lado de uma de 80% vira uma barra de 10% da
 * pista, visualmente indistinguível de zero — e o item deixa de ser legível
 * exatamente onde a régua exige que ele continue visível.
 */
export function fracaoDaBarra(variacao: number, maiorQueda: number): number {
  if (maiorQueda <= 0) return BARRA_FRACAO_PISO
  return Math.max(Math.abs(variacao) / maiorQueda, BARRA_FRACAO_PISO)
}

export function montarGargalos(
  base: BasePadroes,
  falhas: FalhasPorFonte,
): ComEstado<BlocoGargalos> {
  const cabeca = { titulo: TITULO_GARGALOS, subtitulo: SUBTITULO_GARGALOS, acao: ACAO }

  const falha = primeiraFalha(falhas, FONTES_DOS_GARGALOS)
  if (falha) {
    return {
      ...cabeca,
      itens: [],
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
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  // `variacaoPorModulo` já vem ordenado da queda mais forte para a mais fraca e
  // já filtrado pela base mínima.
  const emQueda = base.variacaoPorModulo.filter((m) => m.variacao < 0).slice(0, GARGALOS_MAX)

  if (emQueda.length === 0) {
    return {
      ...cabeca,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_GARGALOS,
      motivoVazio: "sem-gargalos",
    }
  }

  const maiorQueda = Math.abs(emQueda[0]?.variacao ?? 0)

  const itens: ItemGargalo[] = emQueda.map((m, i) => {
    const percent = Math.round(m.variacao * 100)
    return {
      id: m.capituloId,
      posicao: i + 1,
      moduloTitulo: m.titulo,
      variacaoPercent: percent,
      valorTexto: percentualComSinal(percent),
      fracaoBarra: fracaoDaBarra(m.variacao, maiorQueda),
      ativosAtual: m.ativosAtual,
      ativosAnterior: m.ativosAnterior,
    }
  })

  return {
    ...cabeca,
    itens,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
