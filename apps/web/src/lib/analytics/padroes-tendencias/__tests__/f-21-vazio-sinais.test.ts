import { describe, expect, it } from "vitest"
import { VAZIO_SINAIS, computePadroesTendencias } from "../index"
import { cenario, cenarioModulos, contemDigito } from "./cenario"

/**
 * F-21 · §18 estado vazio, com silêncio EXPLICADO.
 *
 * "Nenhum sinal" pode ser time saudável OU dois terços do recorte sem histórico
 * comparável. São mensagens diferentes, e a tela precisa dizer qual das duas é.
 *
 * INVARIÂNCIA: sem padrão → texto da §32 e nenhum dígito solto no corpo.
 * VARIÂNCIA: um módulo em queda recorrente → estado `ok`.
 */

describe("F-21 · sinais vazios", () => {
  it("INVARIÂNCIA — sem padrão, o texto da §32 e zero itens", () => {
    const { sinais } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 8, 15, 22] },
          { id: "b", sessoes: [2, 9, 16, 23] },
        ],
      }),
    )
    expect(sinais.estado).toBe("vazio")
    expect(sinais.textoVazio).toBe(VAZIO_SINAIS)
    expect(sinais.itens).toHaveLength(0)
  })

  it("INVARIÂNCIA — o corpo do bloco vazio não carrega numeral solto", () => {
    const { sinais } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: [1, 8] }] }),
    )
    expect(sinais.textoVazio === null || contemDigito(sinais.textoVazio)).toBe(false)
  })

  it("INVARIÂNCIA — base rasa recebe o complemento que explica o silêncio", () => {
    // Ninguém tem carimbo na janela anterior: o silêncio é falta de base, não
    // saúde. A frase cita quantas pessoas ainda não têm histórico.
    const { sinais } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "a", sessoes: [1, 8] },
          { id: "b", sessoes: [2, 9] },
        ],
      }),
    )
    expect(sinais.textoComplementar).not.toBeNull()
    expect(sinais.textoComplementar).toContain("de 2 pessoas do recorte")
  })

  it("VARIÂNCIA — um módulo em queda recorrente acende o bloco", () => {
    const { sinais } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 1 }]),
    )
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.length).toBeGreaterThan(0)
    expect(sinais.textoVazio).toBeNull()
  })
})
