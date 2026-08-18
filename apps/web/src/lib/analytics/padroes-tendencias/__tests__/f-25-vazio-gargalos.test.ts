import { describe, expect, it } from "vitest"
import { VAZIO_GARGALOS, computePadroesTendencias } from "../index"
import { cenarioModulos } from "./cenario"

/**
 * F-25 · §19 estado vazio: nunca uma tabela com quatro linhas de 0%.
 *
 * INVARIÂNCIA: sem módulo em queda → texto da §32 e zero linhas.
 * VARIÂNCIA: um módulo em queda → estado `ok`.
 */

describe("F-25 · gargalos vazios", () => {
  it("INVARIÂNCIA — sem queda, o texto da §32 e nenhuma linha", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([
        { id: "m1", titulo: "Estável", antes: 5, agora: 5 },
        { id: "m2", titulo: "Subiu", antes: 4, agora: 7 },
      ]),
    )
    expect(gargalos.estado).toBe("vazio")
    expect(gargalos.textoVazio).toBe(VAZIO_GARGALOS)
    expect(gargalos.itens).toHaveLength(0)
  })

  it("INVARIÂNCIA — nenhum módulo com base suficiente também é vazio", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Base rasa", antes: 2, agora: 0 }]),
    )
    expect(gargalos.estado).toBe("vazio")
    expect(gargalos.itens).toHaveLength(0)
  })

  it("VARIÂNCIA — um módulo em queda acende o bloco", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Caiu", antes: 8, agora: 5 }]),
    )
    expect(gargalos.estado).toBe("ok")
    expect(gargalos.itens).toHaveLength(1)
    expect(gargalos.textoVazio).toBeNull()
  })
})
