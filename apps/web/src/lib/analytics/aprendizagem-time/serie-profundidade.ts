// ---------------------------------------------------------------------------
// §18 — Evolução da profundidade. Duas séries semanais (profundidade,
// aplicação) + leitura textual obrigatória (§18.1: "o gráfico não deve
// aparecer sem interpretação").
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { pctAplicacao, pctProfundidade } from "./base"
import { TEXTO_AMOSTRA_INSUFICIENTE, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import { ultimasSemanas } from "./semanas"
import type { BlocoEvolucaoProfundidade, ComEstado, PontoSerieSemanal } from "./tipos"

const VAZIO: BlocoEvolucaoProfundidade = { pontos: [], insight: null }

function elegiveisDaSemana(evidenciasSemana: readonly LinhaEvidencia[]): Set<string> {
  return new Set(evidenciasSemana.map((e) => e.studentId))
}

/**
 * §18.1: leitura textual determinística — compara a média da profundidade na
 * segunda metade da janela contra a primeira, e a aplicação contra a
 * compreensão do período atual (mesmo par que a Tela 1 já mede em
 * `pctCompreensao`/`pctProfundidade`). Regra do §20: correlação nunca vira
 * "causou".
 */
function montarInsight(pontos: readonly PontoSerieSemanal[], base: BaseCalculo): string | null {
  const comProfundidade = pontos.filter((p) => p.profundidadePercent !== null)
  if (comProfundidade.length < 2) return null

  const meio = Math.floor(comProfundidade.length / 2)
  const primeiraMetade = comProfundidade.slice(0, meio)
  const segundaMetade = comProfundidade.slice(meio)
  const media = (xs: typeof comProfundidade) =>
    xs.reduce((soma, p) => soma + (p.profundidadePercent ?? 0), 0) / xs.length
  const tendenciaProfundidade = media(segundaMetade) - media(primeiraMetade)

  const aplicacaoAtual = pctAplicacao(base.evidenciasPeriodoAtual, base.alunosElegiveisPeriodoAtual)
  const profundidadeAtual = pctProfundidade(base.evidenciasPeriodoAtual)

  const direcao =
    tendenciaProfundidade > 2
      ? "vem crescendo"
      : tendenciaProfundidade < -2
        ? "vem caindo"
        : "está estável"

  if (aplicacaoAtual !== null && profundidadeAtual !== null && aplicacaoAtual < profundidadeAtual) {
    return `A profundidade ${direcao} no período, mas a aplicação continua abaixo da profundidade.`
  }
  return `A profundidade ${direcao} no período analisado.`
}

export function montarEvolucaoProfundidade(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
  agoraMs: number,
): ComEstado<BlocoEvolucaoProfundidade> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  const semanas = ultimasSemanas(agoraMs)
  const pontos: PontoSerieSemanal[] = semanas.map((janela) => {
    const daSemana = base.evidenciasPeriodoAtual
      .concat(base.evidenciasPeriodoAnterior)
      .filter((e) => e.occurredAtMs >= janela.inicioMs && e.occurredAtMs < janela.fimMs)
    return {
      rotulo: janela.rotulo,
      inicioSemanaISO: new Date(janela.inicioMs).toISOString(),
      profundidadePercent: pctProfundidade(daSemana),
      aplicacaoPercent: pctAplicacao(daSemana, elegiveisDaSemana(daSemana)),
    }
  })

  const semanasComDado = pontos.filter((p) => p.profundidadePercent !== null).length
  if (semanasComDado < 2) {
    return blocoVazio(VAZIO, "sem-tendencia", TEXTO_AMOSTRA_INSUFICIENTE)
  }

  return blocoOk({ pontos, insight: montarInsight(pontos, base) })
}
