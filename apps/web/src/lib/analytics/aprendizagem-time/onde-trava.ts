// ---------------------------------------------------------------------------
// §21 — Onde a aprendizagem trava. Tabela por "módulo" (proxy: `concepts`,
// ver nota em `fonte.ts`), compreensão × aplicação, valor principal da spec:
// distinguir "entendem mas não aplicam" de "nem compreendem ainda".
//
// `gapPrincipal` (§21, coluna "Gap principal") é rotulado a partir da forma do
// gap medido (Compreensão vs. Aplicação), NUNCA de um texto curricular
// inventado — a spec dá exemplos como "Delimitação"/"Evidência" que são
// julgamento pedagógico específico do curso, sem fonte estruturada nas 8
// tabelas migradas (Artigo IV — No Invention). Decisão documentada, não
// omissão.
// ---------------------------------------------------------------------------

import { AMOSTRA_MIN_EVIDENCIAS, pctAplicacao, pctCompreensao } from "./base"
import type { BaseCalculo } from "./base"
import { TEXTO_AMOSTRA_INSUFICIENTE, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaConceito, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoOndeTrava, ComEstado, LinhaOndeTrava } from "./tipos"

const VAZIO: BlocoOndeTrava = { linhas: [] }
const MAX_LINHAS = 5

function agruparPorConceito(evidencias: readonly LinhaEvidencia[]): Map<string, LinhaEvidencia[]> {
  const mapa = new Map<string, LinhaEvidencia[]>()
  for (const e of evidencias) {
    if (!e.conceptId) continue
    const lista = mapa.get(e.conceptId) ?? []
    lista.push(e)
    mapa.set(e.conceptId, lista)
  }
  return mapa
}

function rotularGap(compreensao: number | null, aplicacao: number | null): string {
  if (compreensao === null && aplicacao === null) return "Amostra insuficiente"
  if (compreensao !== null && compreensao < 60) return "Compreensão"
  if (aplicacao !== null && compreensao !== null && compreensao - aplicacao >= 20)
    return "Aplicação"
  return "Consolidação"
}

export function montarOndeTrava(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  conceitos: readonly LinhaConceito[],
): ComEstado<BlocoOndeTrava> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias", "conceitos"])
  if (falha) return blocoErro(VAZIO, falha)

  if (conceitos.length === 0) {
    return blocoVazio(
      VAZIO,
      "sem-capacidades-no-curso",
      "Selecione um curso para ver esta análise.",
    )
  }

  const porConceito = agruparPorConceito(base.evidenciasPeriodoAtual)
  const linhas: LinhaOndeTrava[] = []

  for (const conceito of conceitos) {
    const evidenciasDoConceito = porConceito.get(conceito.id) ?? []
    if (evidenciasDoConceito.length < AMOSTRA_MIN_EVIDENCIAS) continue
    const elegiveis = new Set(evidenciasDoConceito.map((e) => e.studentId))
    const compreensaoPercent = pctCompreensao(evidenciasDoConceito)
    const aplicacaoPercent = pctAplicacao(evidenciasDoConceito, elegiveis)
    linhas.push({
      conceitoId: conceito.id,
      modulo: conceito.title,
      compreensaoPercent,
      aplicacaoPercent,
      gapPrincipal: rotularGap(compreensaoPercent, aplicacaoPercent),
    })
  }

  if (linhas.length === 0)
    return blocoVazio(VAZIO, "amostra-insuficiente", TEXTO_AMOSTRA_INSUFICIENTE)

  linhas.sort((a, b) => (a.compreensaoPercent ?? 100) - (b.compreensaoPercent ?? 100))
  return blocoOk({ linhas: linhas.slice(0, MAX_LINHAS) })
}
