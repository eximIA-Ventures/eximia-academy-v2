// ---------------------------------------------------------------------------
// §25 — Distribuição por etapa. F-12 a F-16.
// ---------------------------------------------------------------------------
// OS QUATRO NÚMEROS SÃO UMA PARTIÇÃO DO ROSTER. É a lição 4 aplicada à tela:
// ninguém pode cair fora do denominador. Na Visão geral, 4 cards somavam 2 numa
// base de 6, e as 4 pessoas ausentes eram exatamente as que tinham concluído —
// a fileira afirmava implicitamente uma partição que não era partição.
//
// Aqui a partição é construída por EXCLUSÃO SEQUENCIAL sobre o roster inteiro,
// e não por quatro predicados independentes. Não existe caminho de código em
// que alguém caia em dois baldes, nem em nenhum. F-16 fixa isso em teste.
//
// ARREDONDAMENTO: cada percentual é arredondado e o MAIOR balde absorve o resto,
// para a fileira nunca somar 99% ou 101%.
// ---------------------------------------------------------------------------

import { estaSemAtividade } from "./base"
import type { BaseMapa } from "./base"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import {
  ERRO_LEITURA,
  SUBTITULO_DISTRIBUICAO,
  TITULO_DISTRIBUICAO,
  VAZIO_SEM_ESCOPO,
} from "./textos"
import type { BlocoDistribuicao, TileDistribuicao } from "./tipos"

export const CHAVES_DISTRIBUICAO: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

export interface ParticaoDistribuicao {
  concluidos: readonly string[]
  emAndamento: readonly string[]
  travados: readonly string[]
  naoIniciados: readonly string[]
}

/** F-12..F-15 · a partição, por exclusão sequencial sobre o roster inteiro. */
export function particionarRoster(base: BaseMapa): ParticaoDistribuicao {
  const concluidos: string[] = []
  const emAndamento: string[] = []
  const travados: string[] = []
  const naoIniciados: string[] = []

  for (const alunoId of base.roster) {
    if (base.concluiramTudo.has(alunoId)) {
      concluidos.push(alunoId)
      continue
    }
    if (base.naoIniciaram.has(alunoId)) {
      naoIniciados.push(alunoId)
      continue
    }
    // Iniciou e não concluiu: o que separa é a atividade recente.
    if (estaSemAtividade(base.diasSemAtividadePorAluno.get(alunoId) ?? null)) {
      travados.push(alunoId)
      continue
    }
    emAndamento.push(alunoId)
  }

  return { concluidos, emAndamento, travados, naoIniciados }
}

/** Arredonda mantendo a soma em 100. O maior balde absorve o resto. */
function percentuaisQueFecham(valores: readonly number[], total: number): number[] {
  if (total <= 0) return valores.map(() => 0)
  const brutos = valores.map((v) => (v / total) * 100)
  const arredondados = brutos.map((v) => Math.round(v))
  const soma = arredondados.reduce((a, b) => a + b, 0)
  if (soma === 100) return arredondados
  let indiceMaior = 0
  for (let i = 1; i < valores.length; i++) {
    if ((valores[i] ?? 0) > (valores[indiceMaior] ?? 0)) indiceMaior = i
  }
  const ajustado = [...arredondados]
  ajustado[indiceMaior] = (ajustado[indiceMaior] ?? 0) + (100 - soma)
  return ajustado
}

export function montarDistribuicao(
  base: BaseMapa,
  falhas: FalhasPorFonteMapa,
): { bloco: BlocoDistribuicao; particao: ParticaoDistribuicao } {
  const falha = primeiraFalhaMapa(falhas, CHAVES_DISTRIBUICAO)
  const particao = particionarRoster(base)
  const esqueleto = { titulo: TITULO_DISTRIBUICAO, subtitulo: SUBTITULO_DISTRIBUICAO } as const

  if (falha) {
    return {
      bloco: {
        ...esqueleto,
        estado: "erro",
        erro: falha,
        textoVazio: ERRO_LEITURA,
        motivoVazio: null,
        tiles: [],
      },
      particao,
    }
  }

  const total = base.roster.length
  if (total === 0) {
    return {
      bloco: {
        ...esqueleto,
        estado: "vazio",
        erro: null,
        textoVazio: VAZIO_SEM_ESCOPO,
        motivoVazio: "sem-escopo",
        tiles: [],
      },
      particao,
    }
  }

  const valores = [
    particao.concluidos.length,
    particao.emAndamento.length,
    particao.travados.length,
    particao.naoIniciados.length,
  ]
  const pcts = percentuaisQueFecham(valores, total)

  // O rótulo `Travados` é o do PNG; o vocabulário da §4 é `Parado`. Os dois são
  // de apoio, nenhum é punitivo. Divergência registrada na régua (escalação 1),
  // não corrigida aqui: o PNG vence.
  const tiles: TileDistribuicao[] = [
    {
      id: "concluidos",
      rotulo: "Concluídos",
      valor: valores[0] ?? 0,
      pct: pcts[0] ?? 0,
      tom: "green",
      icone: "check",
    },
    {
      id: "em-andamento",
      rotulo: "Em andamento",
      valor: valores[1] ?? 0,
      pct: pcts[1] ?? 0,
      tom: "amber",
      icone: "loader",
    },
    {
      id: "travados",
      rotulo: "Travados",
      valor: valores[2] ?? 0,
      pct: pcts[2] ?? 0,
      tom: "red",
      icone: "pause",
    },
    {
      id: "nao-iniciados",
      rotulo: "Não iniciados",
      valor: valores[3] ?? 0,
      pct: pcts[3] ?? 0,
      tom: "neutral",
      icone: "circle",
    },
  ]

  return {
    bloco: {
      ...esqueleto,
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      tiles,
    },
    particao,
  }
}
