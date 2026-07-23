import { describe, expect, it } from "vitest"
import {
  MIN_DAYS_PER_MODULE,
  fitToDeadline,
  moduleEndDates,
  neutralDurations,
  normalizeDurations,
  plannedCompletionDate,
  zoneOf,
} from "../plan-math"

// Constantes canônicas da demo (SPEC §2.2/§2.3): 8 módulos, teto 126, meta 105.
const N = 8
const FINAL = 126
const META = 105

describe("neutralDurations — ponto de partida (SPEC §2.3)", () => {
  it("distribui uniforme: 8 módulos / 126 dias = 15 cada", () => {
    const d = neutralDurations(N, FINAL)
    expect(d).toEqual([15, 15, 15, 15, 15, 15, 15, 15])
    expect(d.reduce((a, b) => a + b, 0)).toBe(120) // 6 dias de folga
  })
  it("nunca abaixo do mínimo", () => {
    expect(neutralDurations(40, 10)).toEqual(Array(40).fill(MIN_DAYS_PER_MODULE))
  })
})

describe("fitToDeadline — teto duro (SPEC round 19, proof-teto)", () => {
  it("não altera quando já cabe (Moderado 119d, Intenso 92d)", () => {
    const moderado = [7, 14, 14, 21, 14, 21, 14, 14] // soma 119
    expect(fitToDeadline(moderado, FINAL)).toEqual(moderado)
  })

  it("Tranquilo (×1.3, estouraria 153d) é clampado a EXATAMENTE 126d", () => {
    const tranquilo = [9, 18, 18, 27, 18, 27, 18, 18] // soma 153
    const fit = fitToDeadline(tranquilo, FINAL)
    expect(fit.reduce((a, b) => a + b, 0)).toBe(FINAL)
    expect(Math.min(...fit)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
  })

  it("nenhuma entrada estourada ultrapassa o teto e todo módulo >= mínimo", () => {
    for (const scale of [1.1, 1.3, 1.5, 2, 3]) {
      const base = [7, 14, 14, 21, 14, 21, 14, 14].map((d) => Math.round(d * scale))
      const fit = fitToDeadline(base, FINAL)
      expect(fit.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FINAL)
      expect(Math.min(...fit)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    }
  })

  it("teto menor que o mínimo possível → todos no mínimo", () => {
    expect(fitToDeadline([10, 10, 10], 6)).toEqual([4, 4, 4])
  })
})

describe("normalizeDurations — fronteira de escrita", () => {
  it("lança em comprimento errado", () => {
    expect(() => normalizeDurations([15, 15], N, FINAL)).toThrow()
  })
  it("lança em valor não-numérico", () => {
    // biome-ignore lint/suspicious/noExplicitAny: teste de input inválido
    expect(() => normalizeDurations([15, 15, 15, 15, 15, 15, 15, "x" as any], N, FINAL)).toThrow()
  })
  it("floor + min + clamp ao teto", () => {
    const out = normalizeDurations([1, 30, 30, 30, 30, 30, 30, 30], N, FINAL)
    expect(out.length).toBe(N)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    expect(out.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FINAL)
  })
})

describe("moduleEndDates / plannedCompletionDate", () => {
  it("acumula durações a partir de T0 (UTC-estável)", () => {
    const ends = moduleEndDates("2026-01-01", [7, 14])
    expect(ends).toEqual(["2026-01-08", "2026-01-22"])
    expect(plannedCompletionDate("2026-01-01", [7, 14])).toBe("2026-01-22")
  })
})

describe("zoneOf — 3 zonas (SPEC round 16/19)", () => {
  it("green ≤ meta", () => {
    expect(zoneOf(92, META, FINAL)).toBe("green")
    expect(zoneOf(META, META, FINAL)).toBe("green")
  })
  it("amber entre meta e final", () => {
    expect(zoneOf(119, META, FINAL)).toBe("amber")
    expect(zoneOf(FINAL, META, FINAL)).toBe("amber")
  })
  it("red > final (guarda defensiva)", () => {
    expect(zoneOf(153, META, FINAL)).toBe("red")
  })
  it("sem meta: green até o teto, red além", () => {
    expect(zoneOf(119, null, FINAL)).toBe("green")
    expect(zoneOf(127, null, FINAL)).toBe("red")
  })
})
