import { describe, expect, it } from "vitest"
import { TRACO_INTERVALO, rotuloSemana } from "../index"

/**
 * F-13 · Rótulos do eixo X, formatados em UTC (I-6).
 *
 * INVARIÂNCIA: o balde de 26/mai a 01/jun vira "26 mai – 1 jun"; o de 02 a
 *   08/jun vira "2 – 8 jun" (mesmo mês, o nome não se repete).
 * VARIÂNCIA: deslocar o balde em 1 dia muda a string.
 * TERCEIRO CASO: o fuso do processo NÃO pode mudar a saída. Qualquer formatação
 *   por locale do runtime mudaria, e é por isso que a família inteira dessas
 *   chamadas está proibida nesta camada (F-41, que varre o nome literal delas).
 */

const MS_SEMANA = 7 * 86_400_000

function balde(inicioISO: string): string {
  const inicio = Date.parse(inicioISO)
  return rotuloSemana(inicio, inicio + MS_SEMANA)
}

describe("F-13 · rótulos de semana", () => {
  it("INVARIÂNCIA — balde que cruza o mês nomeia os dois meses", () => {
    expect(balde("2026-05-26T00:00:00.000Z")).toBe(`26 mai ${TRACO_INTERVALO} 1 jun`)
  })

  it("INVARIÂNCIA — balde dentro do mês nomeia o mês uma vez só", () => {
    expect(balde("2026-06-02T00:00:00.000Z")).toBe(`2 ${TRACO_INTERVALO} 8 jun`)
  })

  it("VARIÂNCIA — deslocar o balde em 1 dia muda o rótulo", () => {
    expect(balde("2026-06-03T00:00:00.000Z")).toBe(`3 ${TRACO_INTERVALO} 9 jun`)
  })

  it("INVARIÂNCIA — o separador é o traço de intervalo, nunca o travessão", () => {
    // U+2013 é intervalo; U+2014 significa "dado ausente" na casa. Um não pode
    // virar o outro sem trocar o significado do rótulo.
    expect(TRACO_INTERVALO).toBe("–")
    expect(balde("2026-06-02T00:00:00.000Z")).not.toContain("—")
  })

  it("INVARIÂNCIA — o fuso do processo não altera a string", () => {
    const original = process.env.TZ
    try {
      process.env.TZ = "Pacific/Kiritimati"
      const extremoLeste = balde("2026-05-26T00:00:00.000Z")
      process.env.TZ = "Pacific/Midway"
      const extremoOeste = balde("2026-05-26T00:00:00.000Z")
      expect(extremoLeste).toBe(extremoOeste)
      expect(extremoLeste).toBe(`26 mai ${TRACO_INTERVALO} 1 jun`)
    } finally {
      process.env.TZ = original
    }
  })
})
