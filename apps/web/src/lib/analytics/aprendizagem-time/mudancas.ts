// ---------------------------------------------------------------------------
// §10 — O que mudou: até 3 sinais, comparando o período atual com o anterior.
// Nunca mostra variação irrelevante (§10 literal: "Não mostrar variações
// irrelevantes"), e nunca usa "causou" para uma correlação (§20, mesmo
// princípio aplicado aqui por antecipação — a leitura §10 é sobre mudança, não
// sobre causa).
// ---------------------------------------------------------------------------

import { pctAplicacao, pctCompreensao, profundidadeMedia, tendenciaDisponivel } from "./base"
import type { BaseCalculo } from "./base"
import { TEXTO_SEM_TENDENCIA, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoMudancas, ComEstado, SinalMudanca } from "./tipos"

const VAZIO: BlocoMudancas = { sinais: [] }
const MAX_SINAIS = 3
/** Abaixo disto, a variação não é relevante o bastante para ocupar um dos 3 slots. */
const LIMIAR_PP_RELEVANTE = 5

function porCapacidade(evidencias: readonly LinhaEvidencia[]): Map<string, LinhaEvidencia[]> {
  const mapa = new Map<string, LinhaEvidencia[]>()
  for (const e of evidencias) {
    if (!e.capabilityId) continue
    const lista = mapa.get(e.capabilityId) ?? []
    lista.push(e)
    mapa.set(e.capabilityId, lista)
  }
  return mapa
}

export function montarMudancas(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<BlocoMudancas> {
  const falha = primeiraFalha(falhas, ["capacidades", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  if (!tendenciaDisponivel(base.alunosElegiveisPeriodoAnterior.size > 0 ? 2 : 1)) {
    return blocoVazio(VAZIO, "sem-tendencia", TEXTO_SEM_TENDENCIA)
  }

  const titulo = new Map(base.capacidades.map((c) => [c.id, c.title]))
  const atualPorCap = porCapacidade(base.evidenciasPeriodoAtual)
  const anteriorPorCap = porCapacidade(base.evidenciasPeriodoAnterior)

  type Delta = { capacidadeId: string; deltaPp: number }
  const deltas: Delta[] = []
  for (const [capId, lista] of atualPorCap) {
    const listaAnterior = anteriorPorCap.get(capId)
    if (!listaAnterior || listaAnterior.length === 0) continue
    const atual = profundidadeMedia(lista)
    const anterior = profundidadeMedia(listaAnterior)
    if (atual === null || anterior === null) continue
    const deltaPp = Math.round(((atual - 1) / 6) * 100 - ((anterior - 1) / 6) * 100)
    if (Math.abs(deltaPp) >= LIMIAR_PP_RELEVANTE) deltas.push({ capacidadeId: capId, deltaPp })
  }
  deltas.sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp))

  const sinais: SinalMudanca[] = []
  for (const d of deltas.slice(0, 2)) {
    const nome = titulo.get(d.capacidadeId) ?? "Capacidade"
    if (d.deltaPp > 0) {
      sinais.push({
        id: `evolucao-${d.capacidadeId}`,
        texto: `Compreensão de ${nome} aumentou ${d.deltaPp} p.p.`,
        tom: "positivo",
      })
    } else {
      sinais.push({
        id: `queda-${d.capacidadeId}`,
        texto: `${nome} perdeu profundidade (${d.deltaPp} p.p.).`,
        tom: "negativo",
      })
    }
  }

  // Terceiro slot: compreensão vs. aplicação, quando a distância for grande —
  // é o sinal mais citado na spec ("aplicação ainda está abaixo da compreensão").
  if (sinais.length < MAX_SINAIS) {
    const compreensao = pctCompreensao(base.evidenciasPeriodoAtual)
    const aplicacao = pctAplicacao(base.evidenciasPeriodoAtual, base.alunosElegiveisPeriodoAtual)
    if (
      compreensao !== null &&
      aplicacao !== null &&
      compreensao - aplicacao >= LIMIAR_PP_RELEVANTE
    ) {
      sinais.push({
        id: "aplicacao-abaixo-compreensao",
        texto: "Aplicação ainda está abaixo da compreensão.",
        tom: "neutro",
      })
    }
  }

  return blocoOk({ sinais: sinais.slice(0, MAX_SINAIS) })
}
