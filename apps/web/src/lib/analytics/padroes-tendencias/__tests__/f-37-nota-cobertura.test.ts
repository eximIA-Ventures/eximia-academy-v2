import { describe, expect, it } from "vitest"
import { computePadroesTendencias, notaDeCobertura } from "../index"
import { DIAS_REGULARES, PONTE_SEM_PAUSA, cenario } from "./cenario"

/**
 * F-37 · A nota que impede os 4 cards de mentirem por omissão.
 *
 * `EstadoJornada` tem SEIS valores e a §21 desenha QUATRO cards. Sem a nota, os
 * quatro afirmam implicitamente uma partição que não é partição — literalmente
 * o defeito medido na tela do dono (placar com base 6, segmentos somando 2, e
 * as 4 ausentes eram as que haviam CONCLUÍDO).
 *
 * INVARIÂNCIA: roster com concluídos → a nota existe e cita o número certo.
 * VARIÂNCIA: roster em que todos cabem nas 4 categorias → nota `null`, porque
 *   uma nota dizendo "0 pessoas fora" é ruído.
 */

const ANCORA = { id: "ancora", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] }

describe("F-37 · nota de cobertura", () => {
  it("INVARIÂNCIA — a nota nomeia concluídos e não iniciados separadamente", () => {
    expect(notaDeCobertura(3, 1)).toBe(
      "4 pessoas do recorte não aparecem nestas quatro categorias: 3 já concluíram e 1 ainda não iniciou.",
    )
  })

  it("VARIÂNCIA — sem ninguém de fora, a nota é null", () => {
    expect(notaDeCobertura(0, 0)).toBeNull()
  })

  it("INVARIÂNCIA — na tela, a soma dos 4 cards mais a nota fecha o recorte", () => {
    const pessoas = [
      ANCORA,
      { id: "c1", sessoes: [2], matricula: { status: "completed" as const, progresso: 100 } },
      { id: "c2", sessoes: [3], matricula: { status: "completed" as const, progresso: 100 } },
      { id: "novata", semMatricula: true },
    ]
    const { risco, contexto } = computePadroesTendencias(cenario({ pessoas }))
    const nasQuatro = risco.categorias.reduce((s, c) => s + c.pessoas, 0)
    expect(risco.notaCobertura).not.toBeNull()
    const fora = Number.parseInt(risco.notaCobertura?.match(/^(\d+)/)?.[1] ?? "-1", 10)
    expect(nasQuatro + fora).toBe(contexto.totalRecorte)
    expect(fora).toBeGreaterThan(0)
  })

  it("VARIÂNCIA — recorte sem concluído nem estreante não gera nota", () => {
    const { risco } = computePadroesTendencias(
      cenario({ pessoas: [ANCORA, { id: "b", sessoes: [30] }] }),
    )
    const nasQuatro = risco.categorias.reduce((s, c) => s + c.pessoas, 0)
    expect(nasQuatro).toBe(2)
    expect(risco.notaCobertura).toBeNull()
  })

  it("INVARIÂNCIA — a nota fala de pessoas, nunca as nomeia", () => {
    const nota = notaDeCobertura(2, 2)
    expect(nota).not.toBeNull()
    expect(nota).not.toMatch(/Pessoa |Mariana|João/)
  })
})
