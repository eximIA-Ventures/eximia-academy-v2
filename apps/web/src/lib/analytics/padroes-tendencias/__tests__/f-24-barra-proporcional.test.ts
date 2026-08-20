import { describe, expect, it } from "vitest"
import { BARRA_FRACAO_PISO, computePadroesTendencias, fracaoDaBarra } from "../index"
import { cenarioModulos } from "./cenario"

/**
 * F-24 · Comprimento da barra, com PISO.
 *
 * INVARIÂNCIA: com [−18, −15, −11, −8] as frações são [1, 0.833, 0.611, 0.444]
 *   e o piso fica INATIVO — a barra é honestamente proporcional.
 * VARIÂNCIA: com [−80, −8] a segunda cai no piso 0.15. Sem o par, a função
 *   `() => 1` passaria na invariância de "proporcional".
 */

const casas = (v: number) => Math.round(v * 1000) / 1000

describe("F-24 · fração da barra", () => {
  it("INVARIÂNCIA — quedas próximas ficam proporcionais, sem o piso", () => {
    const maior = 0.18
    const fracoes = [0.18, 0.15, 0.11, 0.08].map((q) => casas(fracaoDaBarra(-q, maior)))
    expect(fracoes).toEqual([1, 0.833, 0.611, 0.444])
    expect(fracoes.every((f) => f > BARRA_FRACAO_PISO)).toBe(true)
  })

  it("VARIÂNCIA — queda muito menor cai no piso e continua visível", () => {
    expect(fracaoDaBarra(-0.08, 0.8)).toBe(BARRA_FRACAO_PISO)
  })

  it("INVARIÂNCIA — a maior queda sempre ocupa a barra inteira", () => {
    for (const maior of [0.05, 0.18, 0.9]) {
      expect(fracaoDaBarra(-maior, maior)).toBe(1)
    }
  })

  it("INVARIÂNCIA — na tela, as barras decrescem com os valores", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([
        { id: "m1", titulo: "A", antes: 10, agora: 2 },
        { id: "m2", titulo: "B", antes: 10, agora: 4 },
        { id: "m3", titulo: "C", antes: 10, agora: 6 },
        { id: "m4", titulo: "D", antes: 10, agora: 8 },
      ]),
    )
    const fracoes = gargalos.itens.map((i) => i.fracaoBarra)
    for (let i = 1; i < fracoes.length; i++) {
      expect(fracoes[i - 1] ?? 0).toBeGreaterThan(fracoes[i] ?? 0)
    }
    expect(fracoes[0]).toBe(1)
    expect(fracoes.every((f) => f >= BARRA_FRACAO_PISO && f <= 1)).toBe(true)
  })
})
