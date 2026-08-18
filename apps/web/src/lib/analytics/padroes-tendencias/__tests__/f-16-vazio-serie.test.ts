import { describe, expect, it } from "vitest"
import { VAZIO_TENDENCIA, computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-16 · Estado vazio da série: menos de 2 semanas com atividade.
 *
 * Gráfico vazio é o formato preferido da mentira — parece dado e é ausência.
 * Com menos de duas semanas com carimbo, o bloco não renderiza eixo NEM ponto.
 *
 * INVARIÂNCIA: 1 semana com atividade → `vazio`, texto da §32, zero pontos e
 *   `eixoY === null`.
 * VARIÂNCIA: atividade numa segunda semana → `ok` e a série aparece.
 */

describe("F-16 · série sem histórico suficiente", () => {
  it("INVARIÂNCIA — uma semana só de atividade não vira gráfico", () => {
    const { serie } = computePadroesTendencias(cenario({ pessoas: [{ id: "a", sessoes: [1, 2] }] }))
    expect(serie.estado).toBe("vazio")
    expect(serie.textoVazio).toBe(VAZIO_TENDENCIA)
    expect(serie.pontos).toHaveLength(0)
    expect(serie.eixoY).toBeNull()
  })

  it("VARIÂNCIA — atividade numa segunda semana acende a série", () => {
    const { serie } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: [1, 2, 9] }] }),
    )
    expect(serie.estado).toBe("ok")
    expect(serie.textoVazio).toBeNull()
    expect(serie.pontos).toHaveLength(8)
    expect(serie.eixoY).not.toBeNull()
  })

  it("INVARIÂNCIA — no estado vazio não sobra numeral algum de série", () => {
    const { serie } = computePadroesTendencias(cenario({ pessoas: [{ id: "a", sessoes: [1] }] }))
    expect(JSON.stringify(serie.pontos)).toBe("[]")
    expect(serie.eixoY).toBeNull()
  })
})
