// ---------------------------------------------------------------------------
// §37 — Recomendações de intervenção. Reusa `Recomendacao`/`BlocoRecomendacoes`
// (mesmo contrato das Telas 1/2), derivadas da capacidade com maior gap.
// ---------------------------------------------------------------------------

import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type {
  BlocoCapacidadeComMaiorGap,
  BlocoRecomendacoes,
  ComEstado,
  Recomendacao,
} from "./tipos"

const VAZIO: BlocoRecomendacoes = { itens: [] }

export function montarIntervencoes(
  falhas: FalhasPorFonte,
  capacidadeComMaiorGap: ComEstado<BlocoCapacidadeComMaiorGap>,
): ComEstado<BlocoRecomendacoes> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes"])
  if (falha) return blocoErro(VAZIO, falha)

  const alvo = capacidadeComMaiorGap.estado === "ok" ? capacidadeComMaiorGap.capacidade : null
  if (!alvo) return blocoVazio(VAZIO, "amostra-insuficiente", "Amostra ainda insuficiente")

  const itens: Recomendacao[] = [
    {
      id: "int-clinica",
      prioridade: 1,
      titulo: "Clínica rápida",
      contexto: `Realizar uma clínica de 20 minutos sobre ${alvo.titulo.toLowerCase()}.`,
      cta: "Aplicar ação",
    },
    {
      id: "int-caso-real",
      prioridade: 2,
      titulo: "Caso real",
      contexto: `Utilizar um problema real da equipe para praticar ${alvo.titulo.toLowerCase()}.`,
      cta: "Aplicar ação",
    },
    {
      id: "int-ritual",
      prioridade: 3,
      titulo: "Ritual",
      contexto:
        "Pedir que cada pessoa traga uma evidência concreta antes de validar uma conclusão.",
      cta: "Aplicar ação",
    },
  ]

  return blocoOk({ itens })
}
