import { describe, expect, it } from "vitest"
import { quedaRecorrente } from "../index"

/**
 * F-17 · Sinal por RECORRÊNCIA (§18: "≥2 períodos consecutivos").
 *
 * INVARIÂNCIA: `8,6,4` é queda recorrente de 2 semanas.
 * VARIÂNCIA: `8,6,7` NÃO é (a última diferença sobe) e `2,1,0` NÃO é (base 2,
 *   abaixo do mínimo de 3). As duas negativas são o par de variância: sem elas
 *   um detector que sempre diz "sim" passaria na invariância.
 */

describe("F-17 · queda recorrente por módulo", () => {
  it("INVARIÂNCIA — série 8,6,4 é queda recorrente de 2 semanas", () => {
    const r = quedaRecorrente([8, 6, 4])
    expect(r).not.toBeNull()
    expect(r?.semanas).toBe(2)
    expect(r?.queda).toBe(4)
  })

  it("VARIÂNCIA — série 8,6,7 não é recorrente: a última diferença sobe", () => {
    expect(quedaRecorrente([8, 6, 7])).toBeNull()
  })

  it("VARIÂNCIA — série 2,1,0 não é recorrente: base abaixo do mínimo", () => {
    // Sem a base mínima, um módulo de duas pessoas geraria alarme — e alarme
    // falso gasta exatamente a atenção que a tela existe para economizar.
    expect(quedaRecorrente([2, 1, 0])).toBeNull()
  })

  it("INVARIÂNCIA — série constante não é queda", () => {
    expect(quedaRecorrente([5, 5, 5])).toBeNull()
  })

  it("INVARIÂNCIA — série curta demais não decide nada", () => {
    expect(quedaRecorrente([8, 4])).toBeNull()
    expect(quedaRecorrente([])).toBeNull()
  })

  it("VARIÂNCIA — a sequência mais longa conta mais semanas", () => {
    const curta = quedaRecorrente([9, 8, 6, 4])
    const longa = quedaRecorrente([9, 8, 6, 4, 2])
    expect(curta?.semanas).toBe(3)
    expect(longa?.semanas).toBe(4)
  })
})
