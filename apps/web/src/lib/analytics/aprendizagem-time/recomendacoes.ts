// ---------------------------------------------------------------------------
// §13 — O que fazer agora: até 3 recomendações, regras determinísticas (§42
// da spec permite isso explicitamente pro MVP — "não é obrigatório usar IA
// generativa").
//
// Recebe a SAÍDA REAL de `montarAtencao` em vez de recalcular o ranking de
// gaps — mesma razão documentada em `lib/analytics/_comum/fatos.ts`: uma
// segunda implementação do mesmo critério é a família de defeito que este
// domínio evita em todo lugar (um denominador só, um limiar só).
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { TEXTO_AMOSTRA_INSUFICIENTE, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoAtencao, BlocoRecomendacoes, ComEstado, Recomendacao } from "./tipos"

const VAZIO: BlocoRecomendacoes = { itens: [] }
const MAX_ITENS = 3

export function montarRecomendacoes(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  atencao: ComEstado<BlocoAtencao>,
): ComEstado<BlocoRecomendacoes> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)
  if (atencao.estado === "erro")
    return blocoErro(VAZIO, atencao.erro as NonNullable<typeof atencao.erro>)

  const itens: Recomendacao[] = []
  let prioridade = 1

  // 1-2: derivadas dos gaps já calculados por `montarAtencao` — mesmo texto,
  // mesma ordem, só traduzido para o vocabulário de ação (§13).
  for (const item of atencao.itens.slice(0, 2)) {
    itens.push({
      id: `rec-${item.capacidadeId}`,
      prioridade: prioridade++,
      titulo:
        item.acaoSugerida === "Reforçar conceito"
          ? `Reforçar ${item.gap}`
          : `Propor desafio em ${item.gap}`,
      contexto: item.resumo,
      cta: item.acaoSugerida,
    })
  }

  // 3: reconhecimento — pares aluno×capacidade que subiram de estado no
  // período (nunca desceram, nunca ficaram parados) → "reconhecer evolução".
  let evoluiram = 0
  for (const [chave, estadoAtual] of base.estadoAtualPorPar) {
    const estadoAnterior = base.estadoAnteriorPorPar.get(chave)
    if (!estadoAnterior) continue
    const ordem = ["not_evidenced", "emerging", "developing", "demonstrated"]
    if (ordem.indexOf(estadoAtual) > ordem.indexOf(estadoAnterior)) evoluiram++
  }
  if (evoluiram > 0 && itens.length < MAX_ITENS) {
    itens.push({
      id: "rec-reconhecer",
      prioridade: prioridade++,
      titulo: "Reconhecer evolução",
      contexto: `${evoluiram} ${evoluiram === 1 ? "pessoa apresentou" : "pessoas apresentaram"} evolução de maturidade no período.`,
      cta: "Reconhecer",
    })
  }

  if (itens.length === 0) {
    const elegiveis = base.alunosElegiveisPeriodoAtual.size
    if (elegiveis < 3) return blocoVazio(VAZIO, "amostra-insuficiente", TEXTO_AMOSTRA_INSUFICIENTE)
    return blocoOk({ itens: [] })
  }

  return blocoOk({ itens: itens.slice(0, MAX_ITENS) })
}
