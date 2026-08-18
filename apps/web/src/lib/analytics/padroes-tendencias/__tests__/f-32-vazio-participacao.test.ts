import { describe, expect, it } from "vitest"
import { VAZIO_PARTICIPACAO, VAZIO_SEM_ESCOPO, computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-32 · §20 estado vazio.
 *
 * INVARIÂNCIA: roster vazio → `vazio`, texto presente, SEM barra empilhada e
 *   SEM "0%". Quatro faixas em 0% comunicariam medição; o que há é ausência.
 * VARIÂNCIA: uma pessoa com atividade → `ok`.
 */

describe("F-32 · participação vazia", () => {
  it("INVARIÂNCIA — escopo sem ninguém não renderiza faixa alguma", () => {
    const { participacao } = computePadroesTendencias(cenario({ pessoas: [] }))
    expect(participacao.estado).toBe("vazio")
    expect(participacao.textoVazio).toBe(VAZIO_SEM_ESCOPO)
    expect(participacao.faixas).toHaveLength(0)
    expect(participacao.deltaPp).toBeNull()
  })

  it("INVARIÂNCIA — recorte inteiro sem carimbo também não vira quatro zeros", () => {
    const { participacao } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [] },
          { id: "b", sessoes: [] },
        ],
      }),
    )
    expect(participacao.estado).toBe("vazio")
    expect(participacao.textoVazio).toBe(VAZIO_PARTICIPACAO)
    expect(participacao.faixas).toHaveLength(0)
  })

  it("VARIÂNCIA — uma pessoa com atividade acende o bloco", () => {
    const { participacao } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 8] },
          { id: "b", sessoes: [] },
        ],
      }),
    )
    expect(participacao.estado).toBe("ok")
    expect(participacao.faixas).toHaveLength(4)
  })

  it("INVARIÂNCIA — o denominador continua escrito mesmo no estado vazio", () => {
    // A régua da leitura não some junto com o dado: some é como o leitor perde
    // a referência de contra o que os percentuais seriam medidos.
    const { participacao } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: [] }] }),
    )
    expect(participacao.textoDenominador).toBe("Base: 1 pessoa do recorte.")
  })
})
