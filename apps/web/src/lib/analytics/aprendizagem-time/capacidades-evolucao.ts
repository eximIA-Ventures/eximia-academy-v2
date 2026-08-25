// ---------------------------------------------------------------------------
// §14 — Capacidades com maior evolução. Até 4 linhas, ordenadas pelo maior
// delta positivo. "Estado coletivo" = % de pessoas Em desenvolvimento ou
// Demonstrada (§31, mesma definição literal).
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { TEXTO_SEM_TENDENCIA, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type {
  BlocoCapacidadesEvolucao,
  CapacidadeEvolucao,
  ComEstado,
  EstadoMaturidade,
} from "./tipos"

const VAZIO: BlocoCapacidadesEvolucao = { linhas: [] }
const MAX_LINHAS = 4
const MIN_ALUNOS_POR_CAPACIDADE = 3

function pctEmDesenvolvimentoOuDemonstrada(
  estadosPorAluno: readonly (EstadoMaturidade | undefined)[],
): number | null {
  if (estadosPorAluno.length === 0) return null
  const ok = estadosPorAluno.filter((e) => e === "developing" || e === "demonstrated").length
  return Math.round((ok / estadosPorAluno.length) * 100)
}

export function montarCapacidadesEvolucao(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<BlocoCapacidadesEvolucao> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes"])
  if (falha) return blocoErro(VAZIO, falha)

  const temHistoricoAnterior = base.estadoAnteriorPorPar.size > 0
  if (!temHistoricoAnterior) {
    return blocoVazio(VAZIO, "sem-tendencia", TEXTO_SEM_TENDENCIA)
  }

  const linhas: CapacidadeEvolucao[] = []
  for (const cap of base.capacidades) {
    const alunosDaCapacidade = new Set<string>()
    for (const chave of base.estadoAtualPorPar.keys()) {
      const [studentId, capId] = chave.split(":")
      if (capId === cap.id) alunosDaCapacidade.add(studentId)
    }
    if (alunosDaCapacidade.size < MIN_ALUNOS_POR_CAPACIDADE) continue

    const estadosAtuais = [...alunosDaCapacidade].map((id) =>
      base.estadoAtualPorPar.get(`${id}:${cap.id}`),
    )
    const estadosAnteriores = [...alunosDaCapacidade].map((id) =>
      base.estadoAnteriorPorPar.get(`${id}:${cap.id}`),
    )
    const pctAtual = pctEmDesenvolvimentoOuDemonstrada(estadosAtuais)
    const pctAnterior = pctEmDesenvolvimentoOuDemonstrada(estadosAnteriores)
    if (pctAtual === null) continue

    linhas.push({
      capacidadeId: cap.id,
      titulo: cap.title,
      estadoColetivoPercent: pctAtual,
      deltaPp: pctAnterior !== null ? pctAtual - pctAnterior : null,
    })
  }

  linhas.sort(
    (a, b) => (b.deltaPp ?? Number.NEGATIVE_INFINITY) - (a.deltaPp ?? Number.NEGATIVE_INFINITY),
  )

  return blocoOk({ linhas: linhas.slice(0, MAX_LINHAS) })
}
