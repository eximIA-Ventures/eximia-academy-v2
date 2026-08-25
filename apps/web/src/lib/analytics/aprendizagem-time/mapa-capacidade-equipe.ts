// ---------------------------------------------------------------------------
// §33 — Mapa capacidade × equipe. Matriz pessoa × capacidade, célula = estado
// de maturidade corrente (`base.estadoAtualPorPar`). Roster limitado a
// `MAX_LINHAS` (a tela não pagina — mesma decisão de "top N" dos outros
// blocos desta Tela 3).
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaAluno } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoMapaCapacidadeEquipe, ComEstado, LinhaMapa } from "./tipos"

const VAZIO: BlocoMapaCapacidadeEquipe = { colunas: [], linhas: [] }
const MAX_LINHAS = 8

export function montarMapaCapacidadeEquipe(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  alunos: readonly LinhaAluno[],
): ComEstado<BlocoMapaCapacidadeEquipe> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes", "alunos"])
  if (falha) return blocoErro(VAZIO, falha)
  if (alunos.length === 0 || base.capacidades.length === 0) {
    return blocoVazio(VAZIO, "amostra-insuficiente", "Amostra ainda insuficiente")
  }

  const colunas = base.capacidades.map((c) => ({ capacidadeId: c.id, titulo: c.title }))
  const linhas: LinhaMapa[] = alunos.slice(0, MAX_LINHAS).map((a) => {
    const estados: Record<string, LinhaMapa["estados"][string]> = {}
    for (const c of base.capacidades) {
      estados[c.id] = base.estadoAtualPorPar.get(`${a.id}:${c.id}`) ?? "not_evidenced"
    }
    return { alunoId: a.id, nome: a.nome, estados }
  })

  return blocoOk({ colunas, linhas })
}
