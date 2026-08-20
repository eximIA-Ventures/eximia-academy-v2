import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-12 · Série "Sessões realizadas": conta LINHAS, não pessoas.
 *
 * INVARIÂNCIA: 5 sessões da mesma pessoa na mesma semana contam 5 — é o oposto
 *   exato de F-11, e as duas asserções no MESMO teste provam que as duas séries
 *   não são a mesma função com dois nomes.
 * VARIÂNCIA: apagar uma sessão baixa o ponto para 4.
 */

const ULTIMO = 7

function ponto(entrada: ReturnType<typeof cenario>, i: number) {
  const p = computePadroesTendencias(entrada).serie.pontos[i]
  if (p === undefined) throw new Error(`ponto ${i} não existe`)
  return p
}

describe("F-12 · série de sessões realizadas", () => {
  it("INVARIÂNCIA — 5 sessões da mesma pessoa na mesma semana contam 5", () => {
    const p = ponto(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4, 5] },
          { id: "b", sessoes: [10] },
        ],
      }),
      ULTIMO,
    )
    expect(p.sessoes).toBe(5)
  })

  it("INVARIÂNCIA — no mesmo ponto, ativos vale 1 e sessões vale 5", () => {
    const p = ponto(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4, 5] },
          { id: "b", sessoes: [10] },
        ],
      }),
      ULTIMO,
    )
    // Se as duas séries fossem a mesma função, este par seria impossível — e a
    // pergunta da §34 ("mais pessoas ou só mais sessões?") ficaria sem resposta.
    expect([p.ativos, p.sessoes]).toEqual([1, 5])
  })

  it("VARIÂNCIA — apagar uma sessão baixa o ponto para 4", () => {
    const p = ponto(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 2, 3, 4] },
          { id: "b", sessoes: [10] },
        ],
      }),
      ULTIMO,
    )
    expect(p.sessoes).toBe(4)
  })
})
