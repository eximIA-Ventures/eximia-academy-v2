import { describe, expect, it } from "vitest"
import { GARGALOS_MAX, computePadroesTendencias } from "../index"
import { cenarioModulos } from "./cenario"

/**
 * F-23 · §19: os 4 módulos, numerados 1..4 — MÓDULOS, nunca pessoas.
 *
 * INVARIÂNCIA: 6 módulos em queda → 4 itens, numerados na ordem da magnitude.
 * VARIÂNCIA: aumentar a queda do 5º o promove ao topo.
 * TERCEIRO CASO: nenhum item carrega campo de pessoa — asserção ESTRUTURAL
 *   sobre as chaves, não sobre o texto. É a diferença entre "onde o conteúdo
 *   trava" e "quem está devendo" (I-8).
 */

const SEIS_EM_QUEDA = [
  { id: "m1", titulo: "Executar Ações Corretivas", antes: 10, agora: 2 },
  { id: "m2", titulo: "Monitoramento dos Resultados", antes: 10, agora: 3 },
  { id: "m3", titulo: "Análise de Causa", antes: 10, agora: 4 },
  { id: "m4", titulo: "Ações Corretivas", antes: 10, agora: 5 },
  { id: "m5", titulo: "Plano de Ação", antes: 10, agora: 6 },
  { id: "m6", titulo: "Indicadores", antes: 10, agora: 7 },
]

/** Chaves que denunciariam uma pessoa dentro de um item de módulo. */
const CHAVES_DE_PESSOA = ["alunoId", "studentId", "nome", "iniciais", "avatarTone", "email"]

describe("F-23 · seleção e numeração dos módulos", () => {
  it("INVARIÂNCIA — seis em queda viram quatro, numerados 1..4", () => {
    const { gargalos } = computePadroesTendencias(cenarioModulos(SEIS_EM_QUEDA))
    expect(gargalos.itens).toHaveLength(GARGALOS_MAX)
    expect(gargalos.itens.map((i) => i.posicao)).toEqual([1, 2, 3, 4])
    expect(gargalos.itens.map((i) => i.moduloTitulo)).toEqual([
      "Executar Ações Corretivas",
      "Monitoramento dos Resultados",
      "Análise de Causa",
      "Ações Corretivas",
    ])
  })

  it("VARIÂNCIA — aprofundar a queda do 5º o promove ao topo", () => {
    const promovido = [...SEIS_EM_QUEDA]
    promovido[4] = { id: "m5", titulo: "Plano de Ação", antes: 10, agora: 1 }
    const { gargalos } = computePadroesTendencias(cenarioModulos(promovido))
    expect(gargalos.itens[0]?.moduloTitulo).toBe("Plano de Ação")
    expect(gargalos.itens[0]?.posicao).toBe(1)
  })

  it("INVARIÂNCIA — nenhum item de módulo tem campo de pessoa", () => {
    const { gargalos } = computePadroesTendencias(cenarioModulos(SEIS_EM_QUEDA))
    for (const item of gargalos.itens) {
      for (const chave of CHAVES_DE_PESSOA) {
        expect(Object.keys(item)).not.toContain(chave)
      }
    }
  })

  it("VARIÂNCIA — o detector de campo de pessoa enxerga um item plantado", () => {
    // Sem esta prova, a asserção acima poderia estar cega e aprovar qualquer
    // coisa — que é a lição 1 aplicada a uma asserção de ausência.
    const plantado = { id: "x", posicao: 1, alunoId: "a-1" }
    expect(CHAVES_DE_PESSOA.some((c) => Object.keys(plantado).includes(c))).toBe(true)
  })

  it("INVARIÂNCIA — módulo que SUBIU não entra no bloco de queda", () => {
    const { gargalos } = computePadroesTendencias(
      cenarioModulos([
        { id: "m1", titulo: "Subiu", antes: 4, agora: 9 },
        { id: "m2", titulo: "Caiu", antes: 8, agora: 5 },
      ]),
    )
    expect(gargalos.itens.map((i) => i.moduloTitulo)).toEqual(["Caiu"])
  })
})
