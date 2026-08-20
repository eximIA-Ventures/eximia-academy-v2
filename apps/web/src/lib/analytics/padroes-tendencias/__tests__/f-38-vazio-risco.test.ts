import { describe, expect, it } from "vitest"
import { VAZIO_NINGUEM_INICIOU, VAZIO_SEM_ESCOPO, computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-38 · §21 estado vazio: quatro zeros comunicam "seu time não existe".
 *
 * INVARIÂNCIA: recorte inteiro sem sessão e sem progresso → texto e ZERO cards.
 * VARIÂNCIA: uma pessoa com sessão → 4 cards e estado `ok`.
 */

describe("F-38 · risco vazio", () => {
  it("INVARIÂNCIA — ninguém iniciou: a mensagem diz isso, não '0, 0, 0, 0'", () => {
    const { risco } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", semMatricula: true },
          { id: "b", semMatricula: true },
        ],
      }),
    )
    expect(risco.estado).toBe("vazio")
    expect(risco.textoVazio).toBe(VAZIO_NINGUEM_INICIOU)
    expect(risco.categorias).toHaveLength(0)
    expect(risco.notaCobertura).toBeNull()
  })

  it("INVARIÂNCIA — escopo sem ninguém tem a própria mensagem", () => {
    const { risco } = computePadroesTendencias(cenario({ pessoas: [] }))
    expect(risco.estado).toBe("vazio")
    expect(risco.textoVazio).toBe(VAZIO_SEM_ESCOPO)
    expect(risco.categorias).toHaveLength(0)
  })

  it("VARIÂNCIA — uma pessoa com sessão acende os quatro cards", () => {
    const { risco } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [2] },
          { id: "b", semMatricula: true },
        ],
      }),
    )
    expect(risco.estado).toBe("ok")
    expect(risco.categorias).toHaveLength(4)
  })
})
