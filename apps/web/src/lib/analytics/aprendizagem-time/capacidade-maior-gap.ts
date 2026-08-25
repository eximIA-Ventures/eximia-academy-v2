// ---------------------------------------------------------------------------
// §32 — Capacidade com maior gap. A capacidade de MENOR `percentMaduro` entre
// as já calculadas por `capacidades-do-time.ts` — reusa a saída, não
// recalcula (mesma disciplina de `recomendacoes.ts`).
// ---------------------------------------------------------------------------

import { blocoErro, blocoOk } from "./estado-bloco"
import type { FalhasPorFonte, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoCapacidadeComMaiorGap, BlocoCapacidadesDoTime, ComEstado } from "./tipos"

const VAZIO: BlocoCapacidadeComMaiorGap = { capacidade: null }

export function montarCapacidadeComMaiorGap(
  falhas: FalhasPorFonte,
  capacidadesDoTime: ComEstado<BlocoCapacidadesDoTime>,
  evidenciasDaCapacidade: (capacidadeId: string) => readonly LinhaEvidencia[],
): ComEstado<BlocoCapacidadeComMaiorGap> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes"])
  if (falha) return blocoErro(VAZIO, falha)
  if (capacidadesDoTime.estado !== "ok" || capacidadesDoTime.linhas.length === 0) {
    return blocoOk(VAZIO)
  }

  const pior = [...capacidadesDoTime.linhas].sort((a, b) => a.percentMaduro - b.percentMaduro)[0]
  const evidencias = evidenciasDaCapacidade(pior.capacidadeId)

  const sinais: string[] = [
    `Apenas ${pior.percentMaduro}% de maturidade média do time nesta capacidade.`,
  ]

  const avaliaveis = evidencias.filter((e) => e.comprehension !== null)
  if (avaliaveis.length > 0) {
    const semAplicacao = evidencias.filter(
      (e) => e.applicationLevel === null || e.applicationLevel === "not_evidenced",
    ).length
    const percentSemAplicacao = Math.round((semAplicacao / evidencias.length) * 100)
    if (percentSemAplicacao > 0) {
      sinais.push(`${percentSemAplicacao}% das evidências ainda não têm aplicação registrada.`)
    }
  }

  return blocoOk({
    capacidade: {
      capacidadeId: pior.capacidadeId,
      titulo: pior.titulo,
      texto: `O time compreende o conceito, mas ainda tem maturidade baixa em ${pior.titulo}.`,
      sinais,
    },
  })
}
