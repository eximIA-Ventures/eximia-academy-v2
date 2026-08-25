// ---------------------------------------------------------------------------
// §22 — Conceitos frágeis. Um conceito é frágil quando apresenta ocorrência
// RECORRENTE de erro/confusão (>=3 evidências avaliáveis, nunca uma resposta
// isolada — literal do §22: "não classificar como frágil por uma única
// resposta") e proporção alta de evidências sem compreensão evidenciada.
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaConceito, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoConceitosFrageis, ComEstado, ConceitoFragil } from "./tipos"

const VAZIO: BlocoConceitosFrageis = { linhas: [] }
const MIN_EVIDENCIAS_AVALIAVEIS = 3
const MAX_LINHAS = 4

export function montarConceitosFrageis(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  conceitos: readonly LinhaConceito[],
): ComEstado<BlocoConceitosFrageis> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias", "conceitos"])
  if (falha) return blocoErro(VAZIO, falha)
  if (conceitos.length === 0) {
    return blocoVazio(
      VAZIO,
      "sem-capacidades-no-curso",
      "Selecione um curso para ver esta análise.",
    )
  }

  const porConceito = new Map<string, LinhaEvidencia[]>()
  for (const e of base.evidenciasPeriodoAtual) {
    if (!e.conceptId) continue
    const lista = porConceito.get(e.conceptId) ?? []
    lista.push(e)
    porConceito.set(e.conceptId, lista)
  }

  const linhas: ConceitoFragil[] = []
  for (const conceito of conceitos) {
    const evidenciasDoConceito = (porConceito.get(conceito.id) ?? []).filter(
      (e) => e.comprehension !== null,
    )
    if (evidenciasDoConceito.length < MIN_EVIDENCIAS_AVALIAVEIS) continue

    const fragil = evidenciasDoConceito.filter((e) => e.comprehension !== "evidenced")
    const percentAfetado = Math.round((fragil.length / evidenciasDoConceito.length) * 100)
    if (percentAfetado < 30) continue // limiar de "recorrência", não maioria acidental

    linhas.push({
      conceitoId: conceito.id,
      titulo: conceito.title,
      pessoasAfetadas: new Set(fragil.map((e) => e.studentId)).size,
      percentAfetado,
    })
  }

  if (linhas.length === 0) return blocoOk({ linhas: [] })

  linhas.sort((a, b) => b.percentAfetado - a.percentAfetado)
  return blocoOk({ linhas: linhas.slice(0, MAX_LINHAS) })
}
