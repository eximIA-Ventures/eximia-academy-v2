import { describe, expect, it } from "vitest"
import { EIXO_Y_DIVISOES, eixoY } from "../index"

/**
 * F-14 · Domínio e as 6 marcas do eixo Y.
 *
 * INVARIÂNCIA: pico 190 → passo 40, topo 200, marcas 0/40/80/120/160/200 —
 *   exatamente o que o PNG aprovado desenha.
 * VARIÂNCIA: pico 420 → passo 100 e topo 500. A função não é constante.
 */

describe("F-14 · eixo Y", () => {
  it("INVARIÂNCIA — pico 190 produz o eixo do mockup", () => {
    const eixo = eixoY(190)
    expect(eixo.passo).toBe(40)
    expect(eixo.topo).toBe(200)
    expect(eixo.ticks).toEqual([0, 40, 80, 120, 160, 200])
  })

  it("VARIÂNCIA — pico 420 sobe o passo para 100 e o topo para 500", () => {
    const eixo = eixoY(420)
    expect(eixo.passo).toBe(100)
    expect(eixo.topo).toBe(500)
  })

  it("INVARIÂNCIA — sempre 6 marcas, do zero ao topo, sem repetição", () => {
    for (const pico of [1, 7, 33, 190, 420, 1001]) {
      const eixo = eixoY(pico)
      expect(eixo.ticks).toHaveLength(EIXO_Y_DIVISOES + 1)
      expect(eixo.ticks[0]).toBe(0)
      expect(eixo.ticks[eixo.ticks.length - 1]).toBe(eixo.topo)
      expect(eixo.topo).toBeGreaterThanOrEqual(pico)
      expect(new Set(eixo.ticks).size).toBe(eixo.ticks.length)
    }
  })

  it("INVARIÂNCIA — pico 0 não produz eixo degenerado", () => {
    // O bloco já estaria em estado vazio; se ainda assim renderizar, o eixo tem
    // topo positivo e a linha fica no zero — nunca um eixo 0..0.
    const eixo = eixoY(0)
    expect(eixo.topo).toBeGreaterThan(0)
    expect(eixo.ticks).toHaveLength(EIXO_Y_DIVISOES + 1)
  })
})
