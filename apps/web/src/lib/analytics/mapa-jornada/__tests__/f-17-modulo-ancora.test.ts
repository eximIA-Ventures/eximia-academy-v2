import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, darAtividadeHoje, entradaBase } from "./contrato"

/**
 * F-17 · O módulo âncora do bloco §26 é DERIVADO de F-10, não recalculado.
 *
 * INVARIÂNCIA: o título do bloco é literalmente o do primeiro item da lista de
 *   gargalos, provado por IDENTIDADE — dois caminhos para "o módulo com mais
 *   gente parada" divergem em silêncio no dia em que um empate mudar, e aqui o
 *   empate decide o título de um bloco inteiro.
 * VARIÂNCIA: virar o topo do gargalo troca o módulo do título E a lista de
 *   pessoas.
 */
describe("F-17 · módulo âncora", () => {
  it("INVARIÂNCIA — o título é o do topo dos gargalos", async () => {
    const r = await calcular(entradaBase())
    expect(r.travados.presente).toBe(true)
    expect(r.travados.moduloTitulo).toBe(r.gargalos.linhas[0]?.titulo)
    expect(r.gargalos.linhas[0]?.moduloId).toBe(CAP_ANCORA)
  })

  it("VARIÂNCIA — esvaziar o topo troca o módulo do título e a lista", async () => {
    const antes = await calcular(entradaBase())

    let e = entradaBase()
    for (const alunoId of ["P03", "P04", "P05", "P06"]) {
      e = darAtividadeHoje(e, alunoId, CAP_ANCORA)
    }
    const depois = await calcular(e)

    expect(depois.travados.moduloTitulo).not.toBe(antes.travados.moduloTitulo)
    expect(depois.travados.linhas.map((l) => l.alunoId)).not.toEqual(
      antes.travados.linhas.map((l) => l.alunoId),
    )
  })
})
