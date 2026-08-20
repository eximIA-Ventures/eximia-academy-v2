import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenarioModulos } from "./cenario"

/**
 * F-05 · "Queda acentuada em N módulos −X%".
 *
 * INVARIÂNCIA: dois módulos em queda acentuada produzem UM item, com `n = 2` e
 *   valor igual à MENOR queda do conjunto — lido como piso ("cada um caiu ao
 *   menos X"). Publicar a maior seria exagero por seleção.
 * VARIÂNCIA: tirar o segundo módulo da faixa derruba o item inteiro (um módulo
 *   não é padrão, é ocorrência).
 */

const DOIS_EM_QUEDA = cenarioModulos([
  { id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 5 }, // −17%
  { id: "m2", titulo: "Monitoramento dos Resultados", antes: 4, agora: 3 }, // −25%
])

const UM_EM_QUEDA = cenarioModulos([
  { id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 5 },
  { id: "m2", titulo: "Monitoramento dos Resultados", antes: 4, agora: 4 }, // 0%
])

describe("F-05 · queda acentuada em módulos", () => {
  it("INVARIÂNCIA — dois módulos em queda viram um item com o PISO da queda", () => {
    const item = computePadroesTendencias(DOIS_EM_QUEDA).mudancas.itens.find(
      (i) => i.id === "modulos",
    )
    expect(item?.titulo).toBe("Queda acentuada em 2 módulos")
    expect(item?.valorTexto).toBe("−17%")
    expect(item?.tom).toBe("negativo")
    // Os dois títulos de maior queda, o pior primeiro.
    expect(item?.subtexto).toBe("Monitoramento dos Resultados e Executar Ações Corretivas")
  })

  it("VARIÂNCIA — com um módulo só em queda, o item não entra", () => {
    const item = computePadroesTendencias(UM_EM_QUEDA).mudancas.itens.find(
      (i) => i.id === "modulos",
    )
    expect(item).toBeUndefined()
  })

  it("INVARIÂNCIA — módulo com base menor que 3 nunca vira '−100% em 1 módulo'", () => {
    const base2 = cenarioModulos([
      { id: "m1", titulo: "Base rasa", antes: 2, agora: 0 },
      { id: "m2", titulo: "Outra base rasa", antes: 2, agora: 0 },
    ])
    expect(
      computePadroesTendencias(base2).mudancas.itens.find((i) => i.id === "modulos"),
    ).toBeUndefined()
  })
})
