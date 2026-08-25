// ---------------------------------------------------------------------------
// §35 — Evidências disponíveis. Contagens cumulativas (todo o histórico, não
// só o período filtrado — "não é indicador de performance", §35 literal) por
// `evidence_category`: cognitive → reflexões, application → casos práticos,
// real_context → validações do gestor (§30 Categoria C inclui "validação do
// gestor" como exemplo de evidência de contexto real).
// ---------------------------------------------------------------------------

import { blocoErro, blocoOk } from "./estado-bloco"
import type { FalhasPorFonte, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoEvidenciasDisponiveis, ComEstado } from "./tipos"

const VAZIO: BlocoEvidenciasDisponiveis = {
  reflexoesAnalisadas: 0,
  casosPraticos: 0,
  validacoesGestor: 0,
}

export function montarEvidenciasDisponiveis(
  falhas: FalhasPorFonte,
  evidencias: readonly LinhaEvidencia[],
): ComEstado<BlocoEvidenciasDisponiveis> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  let reflexoesAnalisadas = 0
  let casosPraticos = 0
  let validacoesGestor = 0
  for (const e of evidencias) {
    if (e.evidenceCategory === "cognitive") reflexoesAnalisadas++
    else if (e.evidenceCategory === "application") casosPraticos++
    else if (e.evidenceCategory === "real_context") validacoesGestor++
  }

  return blocoOk({ reflexoesAnalisadas, casosPraticos, validacoesGestor })
}
