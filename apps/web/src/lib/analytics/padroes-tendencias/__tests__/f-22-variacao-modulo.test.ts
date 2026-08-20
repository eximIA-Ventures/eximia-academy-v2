import { describe, expect, it } from "vitest"
import { fonteDaEntrada } from "../entrada"
import { computePadroesTendencias, montarBasePadroes } from "../index"
import { cenarioModulos } from "./cenario"

/**
 * F-22 · §19 variação por módulo, medida por ATIVAÇÃO POR SESSÃO.
 *
 * INVARIÂNCIA: 10 pessoas antes e 8 agora → −20%.
 * VARIÂNCIA: 12 agora → +20%.
 * TERCEIRO CASO: módulo com 2 pessoas na janela anterior NÃO aparece — com base
 *   1, alguém sair vira "−100%" e o gestor recebe alarme de uma pessoa.
 */

function variacoes(defs: Parameters<typeof cenarioModulos>[0]) {
  return montarBasePadroes(fonteDaEntrada(cenarioModulos(defs))).variacaoPorModulo
}

describe("F-22 · variação por módulo", () => {
  it("INVARIÂNCIA — 10 antes e 8 agora dá −20%", () => {
    const v = variacoes([{ id: "m1", titulo: "Análise de Causa", antes: 10, agora: 8 }])
    expect(v).toHaveLength(1)
    expect(Math.round((v[0]?.variacao ?? 0) * 100)).toBe(-20)
    expect(v[0]?.ativosAnterior).toBe(10)
    expect(v[0]?.ativosAtual).toBe(8)
  })

  it("VARIÂNCIA — 12 agora dá +20%", () => {
    const v = variacoes([{ id: "m1", titulo: "Análise de Causa", antes: 10, agora: 12 }])
    expect(Math.round((v[0]?.variacao ?? 0) * 100)).toBe(20)
  })

  it("INVARIÂNCIA — módulo com base 2 não entra na comparação", () => {
    const v = variacoes([
      { id: "m1", titulo: "Base rasa", antes: 2, agora: 0 },
      { id: "m2", titulo: "Base suficiente", antes: 4, agora: 3 },
    ])
    expect(v.map((m) => m.titulo)).toEqual(["Base suficiente"])
  })

  it("INVARIÂNCIA — a lista sai ordenada da queda mais forte para a mais fraca", () => {
    const v = variacoes([
      { id: "m1", titulo: "Cai pouco", antes: 10, agora: 9 },
      { id: "m2", titulo: "Cai muito", antes: 10, agora: 4 },
      { id: "m3", titulo: "Cai médio", antes: 10, agora: 7 },
    ])
    expect(v.map((m) => m.titulo)).toEqual(["Cai muito", "Cai médio", "Cai pouco"])
  })

  it("INVARIÂNCIA — o texto exibido carrega o sinal e o símbolo de porcentagem", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Análise de Causa", antes: 10, agora: 8 }]),
    )
    expect(gargalos.itens[0]?.valorTexto).toBe("−20%")
  })
})
