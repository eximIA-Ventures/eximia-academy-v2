import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-14b · O DOMÍNIO do eixo y de §17 — a régua que o gráfico realmente usa.
 *
 * POR QUE ESTE ARQUIVO EXISTE AO LADO DE F-14 (rodada vermelha).
 */

function recorteDe6ComPico1() {
  return cenario({
    pessoas: [
      { id: "a", sessoes: [1, 9] },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
      { id: "f" },
    ],
  })
}

function picoDe(pontos: readonly { ativos: number; sessoes: number }[]): number {
  return Math.max(0, ...pontos.map((p) => Math.max(p.ativos, p.sessoes)))
}

describe("F-14b · domínio do eixo y da série", () => {
  it("REPROVA HOJE — com 6 pessoas no recorte e pico 1, o eixo vai a 6, não a 5", () => {
    const { serie, contexto } = computePadroesTendencias(recorteDe6ComPico1())

    expect(serie.estado).toBe("ok")
    expect(contexto.totalRecorte).toBe(6)
    expect(picoDe(serie.pontos)).toBe(1)

    expect(serie.eixoY?.topo).toBe(6)
    expect(serie.eixoY?.ticks).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
