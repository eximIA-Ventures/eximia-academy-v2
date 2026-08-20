import { describe, expect, it } from "vitest"
import {
  SEM_COMPARACAO_REGULARIDADE,
  computePadroesTendencias,
  fraseDaRegularidade,
} from "../index"
import { cenario, cenarioRegularidadeCai, cenarioRegularidadeSobe } from "./cenario"

/**
 * F-31 · §20 rodapé: "A regularidade caiu N p.p. no período."
 *
 * INVARIÂNCIA: Δ = −6 vira "caiu 6 p.p.", com o MESMO número de F-04/F-18.
 * VARIÂNCIA: Δ = +6 troca o verbo para "subiu".
 *
 * O QUE ESTE CONTRATO PROTEGE: sem período anterior, a tela NÃO diz "estável".
 * Ausência de comparação e estabilidade medida são afirmações diferentes, e
 * confundi-las é dizer o que o dado não diz.
 */

describe("F-31 · frase da regularidade", () => {
  it("INVARIÂNCIA — queda de 6 p.p. vira a frase do PNG", () => {
    expect(fraseDaRegularidade(-6, 3)).toBe("A regularidade caiu 6 p.p. no período.")
  })

  it("VARIÂNCIA — subida de 6 p.p. troca o verbo", () => {
    expect(fraseDaRegularidade(6, 3)).toBe("A regularidade subiu 6 p.p. no período.")
  })

  it("INVARIÂNCIA — sem comparação, a tela ADMITE em vez de dizer 'estável'", () => {
    expect(fraseDaRegularidade(null, null)).toBe(SEM_COMPARACAO_REGULARIDADE)
    expect(SEM_COMPARACAO_REGULARIDADE).not.toContain("estáv")
    expect(SEM_COMPARACAO_REGULARIDADE).not.toMatch(/\d/)
  })

  it("INVARIÂNCIA — variação abaixo do limiar não vira manchete", () => {
    expect(fraseDaRegularidade(-3, 4)).toBe(SEM_COMPARACAO_REGULARIDADE)
    expect(fraseDaRegularidade(-9, 1)).toBe(SEM_COMPARACAO_REGULARIDADE)
  })

  it("INVARIÂNCIA — na tela, a frase e o deltaPp contam a mesma história", () => {
    const caiu = computePadroesTendencias(cenarioRegularidadeCai(4)).participacao
    expect(caiu.deltaPp).not.toBeNull()
    expect(caiu.frase).toContain("caiu")
    expect(caiu.frase).toContain(`${Math.abs(caiu.deltaPp ?? 0)} p.p.`)

    const subiu = computePadroesTendencias(cenarioRegularidadeSobe(4)).participacao
    expect(subiu.frase).toContain("subiu")
  })

  it("VARIÂNCIA — recorte sem período anterior recebe o texto de ausência", () => {
    const { participacao } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: [1, 3, 8, 10] }] }),
    )
    expect(participacao.deltaPp).toBeNull()
    expect(participacao.frase).toBe(SEM_COMPARACAO_REGULARIDADE)
  })
})
