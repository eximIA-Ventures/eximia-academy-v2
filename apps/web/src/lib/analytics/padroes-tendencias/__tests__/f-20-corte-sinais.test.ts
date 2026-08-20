import { describe, expect, it } from "vitest"
import { SINAIS_MAX, computePadroesTendencias } from "../index"
import { cenarioModulos, cenarioRegularidadeCai } from "./cenario"

/**
 * F-20 · §18: máximo 3 sinais, recorrência antes de limiar.
 *
 * INVARIÂNCIA: com 5 candidatos saem 3, e os de recorrência vêm primeiro — um
 *   padrão que se repete vale mais que uma oscilação isolada (§14).
 * VARIÂNCIA: remover os recorrentes muda a composição dos 3.
 */

/** `n` módulos em queda recorrente, cada um com o próprio grupo de pessoas. */
function cenarioComRecorrentes(n: number) {
  const defs = []
  for (let i = 0; i < n; i++) {
    defs.push({ id: `m${i}`, titulo: `Módulo ${i}`, antes: 6 + i, agora: 1 })
  }
  return cenarioModulos(defs)
}

describe("F-20 · corte e ordenação dos sinais", () => {
  it("INVARIÂNCIA — cinco candidatos viram no máximo 3 itens", () => {
    const { sinais } = computePadroesTendencias(cenarioComRecorrentes(5))
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.length).toBeLessThanOrEqual(SINAIS_MAX)
    expect(sinais.itens).toHaveLength(3)
  })

  it("INVARIÂNCIA — a ordem exibida é 1..n, sem buraco", () => {
    const { sinais } = computePadroesTendencias(cenarioComRecorrentes(5))
    expect(sinais.itens.map((i) => i.ordem)).toEqual([1, 2, 3])
  })

  it("INVARIÂNCIA — recorrência aparece antes de limiar", () => {
    const { sinais } = computePadroesTendencias(cenarioComRecorrentes(4))
    const tipos = sinais.itens.map((i) => i.tipo)
    const ultimoRecorrente = tipos.lastIndexOf("recorrencia")
    const primeiroLimiar = tipos.indexOf("limiar")
    if (primeiroLimiar >= 0 && ultimoRecorrente >= 0) {
      expect(ultimoRecorrente).toBeLessThan(primeiroLimiar)
    }
    expect(tipos[0]).toBe("recorrencia")
  })

  it("VARIÂNCIA — sem módulos recorrentes a composição muda", () => {
    const comRecorrentes = computePadroesTendencias(cenarioComRecorrentes(5)).sinais.itens
    // Recorte SEM capítulo algum: não há série por módulo, logo não há porta de
    // recorrência. Um cenário de "módulos estáveis" não serviria — estável na
    // comparação de janelas ainda decai SEMANA A SEMANA, e a queda semanal é
    // justamente o que a porta de recorrência lê.
    const semRecorrentes = computePadroesTendencias(cenarioRegularidadeCai(4)).sinais.itens
    expect(semRecorrentes.some((i) => i.tipo === "recorrencia")).toBe(false)
    expect(semRecorrentes.length).not.toBe(comRecorrentes.length)
    expect(comRecorrentes.some((i) => i.tipo === "recorrencia")).toBe(true)
  })
})
