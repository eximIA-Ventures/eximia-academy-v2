// ---------------------------------------------------------------------------
// §20 — Padrões emergentes. Até 3 sinais, DERIVADOS dos blocos já calculados
// (conceitos frágeis, módulos com evolução, série de profundidade) — mesma
// disciplina de `recomendacoes.ts` na Tela 1: nunca uma segunda leitura do
// mesmo critério.
//
// §20 regra de fala: "quando houver apenas correlação, usar 'está associado'
// ou 'foi observado conjuntamente', nunca 'causou'." Os textos abaixo seguem
// essa regra ao pé da letra.
// ---------------------------------------------------------------------------

import { blocoErro, blocoOk } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type {
  BlocoConceitosFrageis,
  BlocoEvolucaoProfundidade,
  BlocoModulosEvolucao,
  BlocoPadroesEmergentes,
  ComEstado,
  SinalPadrao,
} from "./tipos"

const VAZIO: BlocoPadroesEmergentes = { sinais: [] }
const MAX_SINAIS = 3

export function montarPadroesEmergentes(
  falhas: FalhasPorFonte,
  conceitosFrageis: ComEstado<BlocoConceitosFrageis>,
  modulosEvolucao: ComEstado<BlocoModulosEvolucao>,
  evolucaoProfundidade: ComEstado<BlocoEvolucaoProfundidade>,
): ComEstado<BlocoPadroesEmergentes> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  const sinais: SinalPadrao[] = []

  if (conceitosFrageis.estado === "ok" && conceitosFrageis.linhas.length > 0) {
    const pior = conceitosFrageis.linhas[0]
    sinais.push({
      id: `fragil-${pior.conceitoId}`,
      titulo: pior.titulo,
      texto: `${pior.percentAfetado}% das evidências ainda não demonstram compreensão consistente — está associado a uma taxa alta de confusão recorrente.`,
      tom: "negativo",
    })
  }

  if (modulosEvolucao.estado === "ok" && modulosEvolucao.linhas.length > 0) {
    const melhor = modulosEvolucao.linhas[0]
    sinais.push({
      id: `evolucao-${melhor.conceitoId}`,
      titulo: melhor.titulo,
      texto: `Compreensão subiu ${melhor.deltaPp} p.p. no período — foi observado conjuntamente com o avanço mais consistente da janela.`,
      tom: "positivo",
    })
  }

  if (
    evolucaoProfundidade.estado === "ok" &&
    evolucaoProfundidade.insight &&
    sinais.length < MAX_SINAIS
  ) {
    sinais.push({
      id: "tendencia-profundidade",
      titulo: "Tendência de profundidade",
      texto: evolucaoProfundidade.insight,
      tom: "neutro",
    })
  }

  return blocoOk({ sinais: sinais.slice(0, MAX_SINAIS) })
}
