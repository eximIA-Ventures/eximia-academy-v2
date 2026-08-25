// ---------------------------------------------------------------------------
// §15 — Gaps prioritários. Mesma ranking de `montarAtencao` (§11), formato de
// exibição diferente (nome + descrição + contagem, sem CTA de ação) — reusa
// a saída em vez de recalcular, mesma razão de `recomendacoes.ts`.
//
// A spec nomeia gaps por CONCEITO ("Evidência x opinião", "Causa x sintoma").
// Sem `concepts`/`capability_concepts` curados nesta entrega (decisão
// documentada em `classificador/fontes-evidencia.ts`), o gap é reportado no
// nível de CAPACIDADE — mais grosso, mas real, nunca um nome de conceito
// inventado.
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { blocoErro, blocoOk } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoAtencao, BlocoGapsPrioritarios, ComEstado, GapPrioritario } from "./tipos"

const VAZIO: BlocoGapsPrioritarios = { linhas: [] }
const MAX_LINHAS = 3

export function montarGapsPrioritarios(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  atencao: ComEstado<BlocoAtencao>,
): ComEstado<BlocoGapsPrioritarios> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes"])
  if (falha) return blocoErro(VAZIO, falha)
  if (atencao.estado === "erro")
    return blocoErro(VAZIO, atencao.erro as NonNullable<typeof atencao.erro>)
  if (atencao.estado === "vazio") {
    return {
      ...VAZIO,
      estado: "vazio",
      erro: null,
      textoVazio: atencao.textoVazio,
      motivoVazio: atencao.motivoVazio,
    }
  }

  const linhas: GapPrioritario[] = atencao.itens.slice(0, MAX_LINHAS).map((item) => {
    const totalAlunos = [...base.estadoAtualPorPar.keys()].filter((chave) =>
      chave.endsWith(`:${item.capacidadeId}`),
    ).length
    const impactados = Number(item.resumo.match(/^(\d+)/)?.[1] ?? 0)
    return {
      capacidadeId: item.capacidadeId,
      titulo: item.gap,
      descricao: item.resumo,
      pessoasImpactadas: impactados,
      percentImpactado: totalAlunos > 0 ? Math.round((impactados / totalAlunos) * 100) : 0,
    }
  })

  return blocoOk({ linhas })
}
