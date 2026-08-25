// ---------------------------------------------------------------------------
// §31 — Capacidades do time. % de pessoas do roster classificadas como
// "Em desenvolvimento" ou "Demonstrada" (nunca "não evidenciada" contando a
// favor — §29.1: ausência de evidência não é incapacidade, mas também não é
// maturidade demonstrada).
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaAluno } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoCapacidadesDoTime, CapacidadeDoTime, ComEstado, NivelPrioridade } from "./tipos"

const VAZIO: BlocoCapacidadesDoTime = { linhas: [] }

/** Limiares MVP — não literais da spec, decisão de engenharia documentada (mesmo espírito de `LIMIAR_PROFUNDIDADE_ALTA`). */
export function prioridadeDe(percentMaduro: number): NivelPrioridade {
  if (percentMaduro >= 70) return "alta"
  if (percentMaduro >= 40) return "media"
  return "baixa"
}

export function montarCapacidadesDoTime(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  alunos: readonly LinhaAluno[],
): ComEstado<BlocoCapacidadesDoTime> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes", "alunos"])
  if (falha) return blocoErro(VAZIO, falha)
  if (alunos.length === 0)
    return blocoVazio(VAZIO, "amostra-insuficiente", "Amostra ainda insuficiente")

  const linhas: CapacidadeDoTime[] = base.capacidades.map((c) => {
    const maduros = alunos.filter((a) => {
      const estado = base.estadoAtualPorPar.get(`${a.id}:${c.id}`)
      return estado === "developing" || estado === "demonstrated"
    }).length
    const percentMaduro = Math.round((maduros / alunos.length) * 100)
    return {
      capacidadeId: c.id,
      titulo: c.title,
      percentMaduro,
      prioridade: prioridadeDe(percentMaduro),
    }
  })

  return blocoOk({ linhas })
}
