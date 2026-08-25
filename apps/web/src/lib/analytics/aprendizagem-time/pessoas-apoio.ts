// ---------------------------------------------------------------------------
// §36 — Pessoas que precisam de apoio. Sempre associado à capacidade com
// maior gap (reusa a saída de `capacidade-maior-gap.ts`). Estados elegíveis:
// "emerging" e "developing" — não "not_evidenced" (§29.1: ausência de
// evidência não é o mesmo que precisar de apoio direcionado) nem
// "demonstrated" (já não precisa).
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk } from "./estado-bloco"
import type { FalhasPorFonte, LinhaAluno } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoCapacidadeComMaiorGap, BlocoPessoasApoio, ComEstado, PessoaApoio } from "./tipos"

const VAZIO: BlocoPessoasApoio = { capacidadeGapTitulo: null, linhas: [] }
const MAX_LINHAS = 6

export function montarPessoasApoio(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  alunos: readonly LinhaAluno[],
  capacidadeComMaiorGap: ComEstado<BlocoCapacidadeComMaiorGap>,
): ComEstado<BlocoPessoasApoio> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes", "alunos"])
  if (falha) return blocoErro(VAZIO, falha)

  const alvo = capacidadeComMaiorGap.estado === "ok" ? capacidadeComMaiorGap.capacidade : null
  if (!alvo) return blocoOk(VAZIO)

  const linhas: PessoaApoio[] = []
  for (const a of alunos) {
    const estado = base.estadoAtualPorPar.get(`${a.id}:${alvo.capacidadeId}`)
    if (estado !== "emerging" && estado !== "developing") continue
    linhas.push({
      alunoId: a.id,
      nome: a.nome,
      estado,
      necessidade:
        estado === "emerging"
          ? `Ainda no início da demonstração de ${alvo.titulo}.`
          : `Aplicação de ${alvo.titulo} ainda inconsistente.`,
    })
  }

  return blocoOk({
    capacidadeGapTitulo: alvo.titulo,
    linhas: linhas.slice(0, MAX_LINHAS),
  })
}
