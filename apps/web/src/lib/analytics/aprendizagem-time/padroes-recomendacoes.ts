// ---------------------------------------------------------------------------
// §24 — O que fazer agora (Tela 2). Reusa o contrato `Recomendacao`/
// `BlocoRecomendacoes` da Tela 1 (§13) — mesma anatomia, derivada de
// `ondeTrava`/`conceitosFrageis` em vez de `atencao`. "As recomendações devem
// estar diretamente ligadas aos padrões apresentados na tela" (§24, literal).
// ---------------------------------------------------------------------------

import { blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type {
  BlocoConceitosFrageis,
  BlocoOndeTrava,
  BlocoRecomendacoes,
  ComEstado,
  Recomendacao,
} from "./tipos"

const VAZIO: BlocoRecomendacoes = { itens: [] }
const MAX_ITENS = 3

export function montarPadroesRecomendacoes(
  falhas: FalhasPorFonte,
  ondeTrava: ComEstado<BlocoOndeTrava>,
  conceitosFrageis: ComEstado<BlocoConceitosFrageis>,
): ComEstado<BlocoRecomendacoes> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  const itens: Recomendacao[] = []
  let prioridade = 1

  if (ondeTrava.estado === "ok" && ondeTrava.linhas.length > 0) {
    const pior = ondeTrava.linhas[0]
    itens.push({
      id: `rec-trava-${pior.conceitoId}`,
      prioridade: prioridade++,
      titulo: `Reforçar evidência em ${pior.modulo}`,
      contexto: `Gap principal: ${pior.gapPrincipal.toLowerCase()}.`,
      cta: "Planejar reforço",
    })
  }

  if (
    conceitosFrageis.estado === "ok" &&
    conceitosFrageis.linhas.length > 0 &&
    itens.length < MAX_ITENS
  ) {
    const fragil = conceitosFrageis.linhas[0]
    itens.push({
      id: `rec-fragil-${fragil.conceitoId}`,
      prioridade: prioridade++,
      titulo: `Propor estudo de caso em ${fragil.titulo}`,
      contexto: `${fragil.pessoasAfetadas} pessoas ainda com compreensão inconsistente.`,
      cta: "Criar atividade",
    })
  }

  if (itens.length === 0)
    return blocoVazio(VAZIO, "amostra-insuficiente", "Amostra ainda insuficiente")
  return blocoOk({ itens: itens.slice(0, MAX_ITENS) })
}
