import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { DIAS_REGULARES, PONTE_SEM_PAUSA, cenario } from "./cenario"

/**
 * F-40 · I-5 — toda variação compara o MESMO universo e durações IDÊNTICAS.
 *
 * INVARIÂNCIA: reduzir o escopo SEM mudar o comportamento de quem ficou não
 *   muda o comportamento de quem ficou — os deltas derivados só das pessoas
 *   remanescentes permanecem.
 * VARIÂNCIA: mudar o comportamento de alguém que FICOU muda os deltas.
 *
 * Nota operacional: os 4 vermelhos conhecidos de `i-5` na Visão geral são de
 * outro escopo (conflito régua-vs-spec já escalado ao dono) e não são tocados
 * aqui.
 */

const NUCLEO = [
  { id: "a", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, 31] },
  { id: "b", sessoes: [2, 5, ...PONTE_SEM_PAUSA, 31] },
  { id: "c", sessoes: [3, 9] },
]
const PERIFERIA = [
  { id: "x", sessoes: [4, 11] },
  { id: "y", sessoes: [6] },
]

function deltas(pessoas: Parameters<typeof cenario>[0]["pessoas"]) {
  const d = computePadroesTendencias(cenario({ pessoas }))
  return {
    janelaAtual: [d.contexto.periodoInicioISO, d.contexto.periodoFimISO],
    janelaAnterior: [d.contexto.periodoAnteriorInicioISO, d.contexto.periodoAnteriorFimISO],
    regularidade: d.participacao.deltaPp,
    serie: d.serie.pontos.map((p) => `${p.inicioISO}|${p.fimISO}`),
  }
}

describe("F-40 · as duas janelas medem o mesmo universo", () => {
  it("INVARIÂNCIA — as duas janelas têm exatamente a mesma duração", () => {
    for (const periodoDias of [7, 30, 90]) {
      const d = computePadroesTendencias(cenario({ pessoas: NUCLEO, periodoDias }))
      const atual = Date.parse(d.contexto.periodoFimISO) - Date.parse(d.contexto.periodoInicioISO)
      const anterior =
        Date.parse(d.contexto.periodoAnteriorFimISO) -
        Date.parse(d.contexto.periodoAnteriorInicioISO)
      expect(anterior).toBe(atual)
    }
  })

  it("INVARIÂNCIA — as janelas são contíguas: o anterior termina onde o atual começa", () => {
    const d = computePadroesTendencias(cenario({ pessoas: NUCLEO }))
    expect(d.contexto.periodoAnteriorFimISO).toBe(d.contexto.periodoInicioISO)
  })

  it("INVARIÂNCIA — reduzir o escopo não altera a régua do tempo", () => {
    const amplo = deltas([...NUCLEO, ...PERIFERIA])
    const restrito = deltas(NUCLEO)
    expect(restrito.janelaAtual).toEqual(amplo.janelaAtual)
    expect(restrito.janelaAnterior).toEqual(amplo.janelaAnterior)
    expect(restrito.serie).toEqual(amplo.serie)
  })

  it("VARIÂNCIA — mudar o comportamento de quem FICOU muda o delta", () => {
    const antes = computePadroesTendencias(cenario({ pessoas: NUCLEO }))
    const mexido = [...NUCLEO]
    mexido[2] = { id: "c", sessoes: [3, 9, 16, 23, 30, 37] }
    const depois = computePadroesTendencias(cenario({ pessoas: mexido }))
    expect(depois.serie.pontos.map((p) => p.sessoes)).not.toEqual(
      antes.serie.pontos.map((p) => p.sessoes),
    )
  })

  it("INVARIÂNCIA — o denominador de todo percentual é o roster, um só", () => {
    const d = computePadroesTendencias(cenario({ pessoas: [...NUCLEO, ...PERIFERIA] }))
    expect(d.contexto.totalRecorte).toBe(5)
    const soma = d.participacao.faixas.reduce((s, f) => s + f.pessoas, 0)
    expect(soma).toBe(d.contexto.totalRecorte)
  })
})
