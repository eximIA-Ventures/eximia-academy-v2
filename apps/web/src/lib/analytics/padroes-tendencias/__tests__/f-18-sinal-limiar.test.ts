import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenarioRegularidadeCai, cenarioRegularidadeSobe } from "./cenario"

/**
 * F-18 · Sinal por LIMIAR, e o contrato cruzado que ele carrega.
 *
 * O número da regularidade aparece em TRÊS lugares da tela: §16 (F-04), §18
 * (este) e §20 (F-31). Três lugares mostrando três valores para a mesma coisa é
 * o defeito clássico, e a única defesa é não haver três cálculos.
 *
 * INVARIÂNCIA: numa mesma fixture, os três textos citam o MESMO número.
 * VARIÂNCIA: mudar a fixture move os três JUNTOS — prova que leem a mesma
 *   fonte, e não três constantes que por acaso coincidem.
 */

/** O primeiro inteiro de um texto. É assim que se compara o que a tela MOSTRA. */
function numeroDe(texto: string): number | null {
  const m = texto.match(/(\d+)/)
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10)
}

function trio(entrada: ReturnType<typeof cenarioRegularidadeCai>) {
  const d = computePadroesTendencias(entrada)
  const mudanca = d.mudancas.itens.find((i) => i.id === "regularidade")
  const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
  return {
    emMudancas: mudanca === undefined ? null : numeroDe(mudanca.valorTexto),
    emSinais: sinal === undefined ? null : numeroDe(sinal.descricao),
    emParticipacao: numeroDe(d.participacao.frase),
    deltaPp: d.participacao.deltaPp,
  }
}

describe("F-18 · sinal de limiar e o número único da regularidade", () => {
  it("INVARIÂNCIA — §16, §18 e §20 citam o mesmo número", () => {
    const t = trio(cenarioRegularidadeCai(4))
    expect(t.emMudancas).not.toBeNull()
    expect(t.emSinais).toBe(t.emMudancas)
    expect(t.emParticipacao).toBe(t.emMudancas)
    expect(t.emMudancas).toBe(Math.abs(t.deltaPp ?? 0))
  })

  it("VARIÂNCIA — outra fixture move os três juntos", () => {
    const a = trio(cenarioRegularidadeCai(4))
    const b = trio(cenarioRegularidadeCai(6))
    expect(b.emMudancas).not.toBe(a.emMudancas)
    expect(b.emSinais).toBe(b.emMudancas)
    expect(b.emParticipacao).toBe(b.emMudancas)
  })

  it("INVARIÂNCIA — queda usa 'Redução' e badge de queda", () => {
    const d = computePadroesTendencias(cenarioRegularidadeCai(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    expect(sinal?.titulo).toBe("Menor regularidade de estudos")
    expect(sinal?.descricao).toContain("Redução de")
    expect(sinal?.descricao).toContain("p.p. em alunos que estudam 2x ou mais por semana")
  })

  it("VARIÂNCIA — subida usa 'Aumento' e o título espelhado", () => {
    const d = computePadroesTendencias(cenarioRegularidadeSobe(4))
    const sinal = d.sinais.itens.find((i) => i.tipo === "limiar")
    expect(sinal?.titulo).toBe("Maior regularidade de estudos")
    expect(sinal?.descricao).toContain("Aumento de")
  })
})
