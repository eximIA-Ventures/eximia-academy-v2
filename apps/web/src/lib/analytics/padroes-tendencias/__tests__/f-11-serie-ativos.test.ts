import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-11 · Série "Alunos ativos": deduplica por PESSOA na semana.
 *
 * INVARIÂNCIA: cinco sessões da mesma pessoa na mesma semana valem 1 naquele
 *   ponto. É primo de I-1 (contar pessoas, não eventos).
 * VARIÂNCIA: mover uma das sessões para a semana anterior faz aparecer 1 no
 *   ponto anterior — a função não é constante no eixo do tempo.
 */

/** Índice do último balde (semana mais recente) numa série de 8. */
const ULTIMO = 7

function ativos(entrada: ReturnType<typeof cenario>): number[] {
  return computePadroesTendencias(entrada).serie.pontos.map((p) => p.ativos)
}

describe("F-11 · série de pessoas ativas", () => {
  it("INVARIÂNCIA — 5 sessões da mesma pessoa na mesma semana contam 1", () => {
    const serie = ativos(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4, 5] },
          { id: "b", sessoes: [10] },
        ],
      }),
    )
    expect(serie[ULTIMO]).toBe(1)
  })

  it("VARIÂNCIA — mover uma sessão para a semana anterior acende o ponto anterior", () => {
    const antes = ativos(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4, 5] },
          { id: "b", sessoes: [10] },
        ],
      }),
    )
    const depois = ativos(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4, 9] },
          { id: "b", sessoes: [10] },
        ],
      }),
    )
    expect(antes[ULTIMO - 1]).toBe(1)
    expect(depois[ULTIMO - 1]).toBe(2)
  })

  it("INVARIÂNCIA — semana sem ninguém é ponto 0 legítimo, não buraco", () => {
    const serie = ativos(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 10] },
          { id: "b", sessoes: [2] },
        ],
      }),
    )
    expect(serie).toHaveLength(8)
    expect(serie[0]).toBe(0)
    expect(serie.every((v) => Number.isInteger(v))).toBe(true)
  })
})
