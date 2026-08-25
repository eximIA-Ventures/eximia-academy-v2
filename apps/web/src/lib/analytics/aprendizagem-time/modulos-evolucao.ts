// ---------------------------------------------------------------------------
// §23 — Módulos com maior evolução. Delta de compreensão por conceito entre
// período atual e período anterior (mesmo par de janelas de `base.ts`).
// ---------------------------------------------------------------------------

import { pctCompreensao } from "./base"
import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaConceito, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoModulosEvolucao, ComEstado, ModuloEvolucao } from "./tipos"

const VAZIO: BlocoModulosEvolucao = { linhas: [] }
const MAX_LINHAS = 4

function agrupar(evidencias: readonly LinhaEvidencia[]): Map<string, LinhaEvidencia[]> {
  const mapa = new Map<string, LinhaEvidencia[]>()
  for (const e of evidencias) {
    if (!e.conceptId) continue
    const lista = mapa.get(e.conceptId) ?? []
    lista.push(e)
    mapa.set(e.conceptId, lista)
  }
  return mapa
}

export function montarModulosEvolucao(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  conceitos: readonly LinhaConceito[],
): ComEstado<BlocoModulosEvolucao> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias", "conceitos"])
  if (falha) return blocoErro(VAZIO, falha)
  if (conceitos.length === 0) {
    return blocoVazio(
      VAZIO,
      "sem-capacidades-no-curso",
      "Selecione um curso para ver esta análise.",
    )
  }

  const atualPorConceito = agrupar(base.evidenciasPeriodoAtual)
  const anteriorPorConceito = agrupar(base.evidenciasPeriodoAnterior)

  const linhas: ModuloEvolucao[] = []
  for (const conceito of conceitos) {
    const atual = pctCompreensao(atualPorConceito.get(conceito.id) ?? [])
    const anterior = pctCompreensao(anteriorPorConceito.get(conceito.id) ?? [])
    if (atual === null || anterior === null) continue // §7: sem os dois períodos, não há tendência a declarar
    const deltaPp = atual - anterior
    if (deltaPp <= 0) continue // este bloco só declara evolução POSITIVA (título é literal: "maior evolução")
    linhas.push({ conceitoId: conceito.id, titulo: conceito.title, deltaPp })
  }

  if (linhas.length === 0) return blocoOk({ linhas: [] })

  linhas.sort((a, b) => b.deltaPp - a.deltaPp)
  return blocoOk({ linhas: linhas.slice(0, MAX_LINHAS) })
}
