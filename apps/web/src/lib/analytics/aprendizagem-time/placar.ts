// ---------------------------------------------------------------------------
// §9 — Placar da aprendizagem: Compreensão / Profundidade / Aplicação / Evolução.
// ---------------------------------------------------------------------------

import {
  type BaseCalculo,
  amostraSuficiente,
  pctAplicacao,
  pctCompreensao,
  pctProfundidade,
  profundidadeMedia,
  tendenciaDisponivel,
} from "./base"
import { TEXTO_AMOSTRA_INSUFICIENTE, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { ComEstado, PlacarAprendizagem } from "./tipos"

const VAZIO: PlacarAprendizagem = {
  compreensao: { valorPercent: null, deltaPp: null },
  profundidade: { valorPercent: null, deltaPp: null },
  aplicacao: { valorPercent: null, deltaPp: null },
  evolucao: { valorPercent: null, deltaPp: null },
}

function normalizarProfundidade(mediaUmASete: number): number {
  // Mesma fórmula da §19: (nível médio - 1) / 6 × 100 — só para exibição.
  return ((mediaUmASete - 1) / 6) * 100
}

export function montarPlacar(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<PlacarAprendizagem> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  const elegiveis = base.alunosElegiveisPeriodoAtual
  const avaliaveis = base.evidenciasPeriodoAtual.filter((e) => e.comprehension !== null)

  if (!amostraSuficiente(elegiveis.size, avaliaveis.length)) {
    return blocoVazio(VAZIO, "amostra-insuficiente", TEXTO_AMOSTRA_INSUFICIENTE)
  }

  const profAtual = profundidadeMedia(base.evidenciasPeriodoAtual)
  const profAnterior = profundidadeMedia(base.evidenciasPeriodoAnterior)

  // §9.4: "evolução da profundidade média" — a dimensão escolhida para o MVP
  // (a spec permite essa OU "evolução da aplicação"; profundidade é a que tem
  // sinal numérico direto sem exigir um segundo denominador de aprendizes).
  let deltaEvolucaoPp: number | null = null
  if (
    profAtual !== null &&
    profAnterior !== null &&
    tendenciaDisponivel(base.alunosElegiveisPeriodoAnterior.size > 0 ? 2 : 1)
  ) {
    deltaEvolucaoPp = Math.round(
      normalizarProfundidade(profAtual) - normalizarProfundidade(profAnterior),
    )
  }

  return blocoOk({
    compreensao: { valorPercent: pctCompreensao(base.evidenciasPeriodoAtual), deltaPp: null },
    profundidade: { valorPercent: pctProfundidade(base.evidenciasPeriodoAtual), deltaPp: null },
    aplicacao: {
      valorPercent: pctAplicacao(base.evidenciasPeriodoAtual, elegiveis),
      deltaPp: null,
    },
    evolucao: {
      valorPercent: profAtual !== null ? Math.round(normalizarProfundidade(profAtual)) : null,
      deltaPp: deltaEvolucaoPp,
    },
  })
}
