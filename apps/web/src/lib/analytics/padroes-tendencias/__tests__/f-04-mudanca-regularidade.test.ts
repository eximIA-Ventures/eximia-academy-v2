import { describe, expect, it } from "vitest"
import { computePadroesTendencias, fonteDaEntrada, montarBasePadroes } from "../index"
import { cenarioRegularidadeCai, cenarioRegularidadeSobe } from "./cenario"

/**
 * F-04 · "Queda na regularidade ±N p.p." e o DENOMINADOR desta tela.
 *
 * INVARIÂNCIA: o denominador é o `roster` inteiro (10), não `iniciados`. A
 *   asserção fixa isso de propósito: a Visão geral divide o indicador dela por
 *   `iniciados`, e uma troca silenciosa aqui reprova este teste — que é a única
 *   defesa mecânica contra as duas abas mostrarem números diferentes para a
 *   mesma palavra.
 * VARIÂNCIA: dobrar o número de pessoas regulares dobra o Δ p.p.
 */

function regularidade(entrada: ReturnType<typeof cenarioRegularidadeSobe>) {
  return montarBasePadroes(fonteDaEntrada(entrada)).regularidade
}

describe("F-04 · variação da regularidade", () => {
  it("INVARIÂNCIA — o denominador é o roster congelado", () => {
    const r = regularidade(cenarioRegularidadeSobe(3))
    expect(r.denominador).toBe(10)
    expect(r.regularesAtual).toBe(3)
    expect(r.regularesAnterior).toBe(0)
    expect(r.taxaAtualPct).toBe(30)
    expect(r.deltaPp).toBe(30)
    expect(r.deltaPessoas).toBe(3)
  })

  it("VARIÂNCIA — 5 regulares em vez de 3 movem o Δ p.p.", () => {
    expect(regularidade(cenarioRegularidadeSobe(5)).deltaPp).toBe(50)
  })

  it("INVARIÂNCIA — a queda vira item de §16 com p.p. e tom negativo", () => {
    const item = computePadroesTendencias(cenarioRegularidadeCai(3)).mudancas.itens.find(
      (i) => i.id === "regularidade",
    )
    expect(item?.titulo).toBe("Queda na regularidade")
    expect(item?.valorTexto).toBe("−30 p.p.")
    expect(item?.tom).toBe("negativo")
  })

  it("VARIÂNCIA — sem carimbo na janela anterior, o delta é null e o item não entra", () => {
    const semAnterior = computePadroesTendencias(
      // Todo mundo só tem atividade na janela atual: não há o que comparar.
      {
        ...cenarioRegularidadeSobe(3),
        atividades: cenarioRegularidadeSobe(3).atividades.filter(
          (a) => Date.parse(a.createdAt) >= Date.parse("2026-07-18T12:00:00.000Z"),
        ),
      },
    )
    expect(
      semAnterior.mudancas.itens.find((i) => i.id === "regularidade"),
      "ausência de comparação nunca vira 0 p.p.",
    ).toBeUndefined()
  })
})
