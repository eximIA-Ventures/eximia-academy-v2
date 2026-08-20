import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario } from "./cenario"

/**
 * F-06 · "Retomadas +N".
 *
 * INVARIÂNCIA: duas pessoas com pausa de 35 dias cujo RETORNO cai na janela
 *   atual produzem "+2", em tom positivo. O limiar é 2 e não 3 por assimetria
 *   deliberada: reconhecer custa menos que alarmar.
 * VARIÂNCIA: mover o retorno para FORA da janela atual zera o item — ele some,
 *   e nunca vira "+0 retomadas".
 */

const RETOMARAM = cenario({
  pessoas: [
    { id: "a", sessoes: [45, 10] },
    { id: "b", sessoes: [50, 8] },
    { id: "c", sessoes: [2] },
  ],
})

const RETORNO_FORA_DA_JANELA = cenario({
  pessoas: [
    { id: "a", sessoes: [60, 35] },
    { id: "b", sessoes: [65, 38] },
    { id: "c", sessoes: [2] },
  ],
})

describe("F-06 · retomadas", () => {
  it("INVARIÂNCIA — 2 retornos dentro da janela viram '+2' positivo", () => {
    const item = computePadroesTendencias(RETOMARAM).mudancas.itens.find(
      (i) => i.id === "retomadas",
    )
    expect(item?.valorTexto).toBe("+2")
    expect(item?.tom).toBe("positivo")
    // O denominador vai no texto: "2 retomadas" entre 3 ativas comunica outra
    // coisa que entre 300.
    expect(item?.subtexto).toContain("de 3 pessoas ativas")
  })

  it("VARIÂNCIA — retorno fora da janela atual derruba o item", () => {
    const item = computePadroesTendencias(RETORNO_FORA_DA_JANELA).mudancas.itens.find(
      (i) => i.id === "retomadas",
    )
    expect(item).toBeUndefined()
  })
})
