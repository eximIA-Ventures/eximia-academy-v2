import { describe, expect, it } from "vitest"
import { computePadroesTendencias, percentuaisMaiorResto } from "../index"
import { DIAS_REGULARES, PONTE_SEM_PAUSA, cenario } from "./cenario"

/**
 * F-30 · Partição exaustiva, soma exata de 100 e denominador ESCRITO.
 *
 * Arredondar cada faixa isoladamente produz 101% com frequência, e a barra
 * empilhada estoura o trilho. O maior resto garante 100 sem mentir sobre
 * nenhuma faixa em mais de um ponto percentual.
 *
 * INVARIÂNCIA: sobre 200 composições geradas, Σn = roster e Σpct = 100.
 * VARIÂNCIA: acrescentar uma pessoa muda o denominador escrito e ao menos um
 *   percentual.
 */

/** Um roster de `n` pessoas com padrões variados, determinístico. */
function rosterDe(n: number) {
  const pessoas = []
  for (let i = 0; i < n; i++) {
    const modo = i % 4
    if (modo === 0) pessoas.push({ id: `p${i}`, sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] })
    else if (modo === 1) pessoas.push({ id: `p${i}`, sessoes: [1, 8, 15, 22] })
    else if (modo === 2) pessoas.push({ id: `p${i}`, sessoes: [3] })
    else pessoas.push({ id: `p${i}`, sessoes: [] })
  }
  return pessoas
}

describe("F-30 · partição exaustiva e soma exata", () => {
  it("INVARIÂNCIA — 200 composições: soma das pessoas fecha o roster", () => {
    for (let n = 1; n <= 200; n++) {
      const { participacao, contexto } = computePadroesTendencias(cenario({ pessoas: rosterDe(n) }))
      if (participacao.estado !== "ok") continue
      const soma = participacao.faixas.reduce((s, f) => s + f.pessoas, 0)
      expect(soma, `roster de ${n} pessoas`).toBe(contexto.totalRecorte)
      expect(soma).toBe(n)
    }
  })

  it("INVARIÂNCIA — 200 composições: os percentuais somam EXATAMENTE 100", () => {
    for (let n = 1; n <= 200; n++) {
      const { participacao } = computePadroesTendencias(cenario({ pessoas: rosterDe(n) }))
      if (participacao.estado !== "ok") continue
      const soma = participacao.faixas.reduce((s, f) => s + f.percentual, 0)
      expect(soma, `roster de ${n} pessoas somou ${soma}%`).toBe(100)
    }
  })

  it("INVARIÂNCIA — o arredondamento ingênuo é que estouraria (prova do método)", () => {
    // 3 faixas de 1/3: piso 33+33+33 = 99, e o ingênuo daria 33+33+33 ou 101 com
    // `round`. O maior resto entrega 34/33/33.
    expect(percentuaisMaiorResto([1, 1, 1], 3)).toEqual([34, 33, 33])
    expect(percentuaisMaiorResto([1, 1, 1], 3).reduce((s, v) => s + v, 0)).toBe(100)
  })

  it("INVARIÂNCIA — o denominador é texto RENDERIZADO, não hover", () => {
    const { participacao } = computePadroesTendencias(cenario({ pessoas: rosterDe(12) }))
    expect(participacao.textoDenominador).toBe("Base: 12 pessoas do recorte.")
  })

  it("VARIÂNCIA — uma pessoa a mais muda o denominador escrito", () => {
    const a = computePadroesTendencias(cenario({ pessoas: rosterDe(12) })).participacao
    const b = computePadroesTendencias(cenario({ pessoas: rosterDe(13) })).participacao
    expect(b.textoDenominador).not.toBe(a.textoDenominador)
    expect(b.faixas.map((f) => f.percentual)).not.toEqual(a.faixas.map((f) => f.percentual))
  })
})
