import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario, cenarioAtivosMais3 } from "./cenario"

/**
 * F-02 · O subtítulo comparativo do §16 descreve a RÉGUA, não o dado.
 *
 * INVARIÂNCIA: com 30 dias, "Comparado aos 30 dias anteriores" — e ele
 *   permanece visível mesmo com o bloco em `vazio`, senão o leitor perde a
 *   referência da comparação exatamente quando ela é mais necessária.
 * VARIÂNCIA: 7 e 90 dias produzem outro subtítulo.
 */

describe("F-02 · subtítulo comparativo", () => {
  it("INVARIÂNCIA — 30 dias produzem o literal da régua", () => {
    const dados = computePadroesTendencias(cenarioAtivosMais3(30))
    expect(dados.mudancas.subtitulo).toBe("Comparado aos 30 dias anteriores")
  })

  it("INVARIÂNCIA — o subtítulo sobrevive ao estado vazio", () => {
    const dados = computePadroesTendencias(cenario({ pessoas: [], periodoDias: 30 }))
    expect(dados.mudancas.estado).toBe("vazio")
    expect(dados.mudancas.subtitulo).toBe("Comparado aos 30 dias anteriores")
  })

  it("VARIÂNCIA — 7 e 90 dias mudam o subtítulo", () => {
    expect(computePadroesTendencias(cenarioAtivosMais3(7)).mudancas.subtitulo).toBe(
      "Comparado aos 7 dias anteriores",
    )
    expect(computePadroesTendencias(cenarioAtivosMais3(90)).mudancas.subtitulo).toBe(
      "Comparado aos 90 dias anteriores",
    )
  })
})
