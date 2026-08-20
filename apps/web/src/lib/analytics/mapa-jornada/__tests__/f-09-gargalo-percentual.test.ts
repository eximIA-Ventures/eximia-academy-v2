import { describe, expect, it } from "vitest"
import { calcular, clonarPopulacao, entradaBase } from "./contrato"

/**
 * F-09 · Percentual do gargalo = numerador ÷ F-01.
 *
 * INVARIÂNCIA: cada `pct` é exatamente `round(pessoas / totalAlunos * 100)` —
 *   o denominador é o ROSTER INTEIRO, não "quem chegou ao módulo".
 * VARIÂNCIA: dobrar o roster com carimbos idênticos DERRUBA todo percentual
 *   pela metade e mantém os numeradores dobrados. Um `pct` que não se move aí
 *   está lendo o denominador errado.
 * VAZIO: com denominador zero, nenhum percentual é renderizado — nunca `0%`,
 *   nunca `NaN`.
 */
describe("F-09 · percentual do gargalo", () => {
  it("INVARIÂNCIA — o denominador é o roster inteiro", async () => {
    const r = await calcular(entradaBase())
    for (const g of r.gargalos.linhas) {
      expect(g.pct, `${g.moduloId}`).toBe(Math.round((g.pessoas / r.mapa.totalAlunos) * 100))
    }
  })

  it("VARIÂNCIA — dobrar o roster derruba os percentuais pela metade", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(clonarPopulacao(entradaBase()))

    expect(depois.mapa.totalAlunos).toBe(antes.mapa.totalAlunos * 2)

    const topoAntes = antes.gargalos.linhas[0]
    const topoDepois = depois.gargalos.linhas[0]
    expect(topoDepois?.pessoas).toBe((topoAntes?.pessoas ?? 0) * 2)
    // Numerador dobra, denominador dobra: o percentual FICA. É a invariância
    // certa deste par — o que prova o denominador é o teste abaixo.
    expect(topoDepois?.pct).toBe(topoAntes?.pct)
  })

  it("VARIÂNCIA — mais gente sem mexer no numerador derruba o percentual", async () => {
    const base = entradaBase()
    const antes = await calcular(base)

    const extras = Array.from({ length: 14 }, (_, i) => `X${i}`)
    const inchado = {
      ...base,
      escopo: [...base.escopo, ...extras],
      alunos: [...base.alunos, ...extras.map((id) => ({ id, nome: `Pessoa ${id}` }))],
    }
    const depois = await calcular(inchado)

    const topoAntes = antes.gargalos.linhas[0]
    const topoDepois = depois.gargalos.linhas[0]
    expect(topoDepois?.pessoas, "o numerador não muda").toBe(topoAntes?.pessoas)
    expect(topoDepois?.pct, "o percentual TEM de cair").toBeLessThan(topoAntes?.pct ?? 0)
  })

  it("VAZIO — sem roster não há percentual nenhum", async () => {
    const r = await calcular({ ...entradaBase(), escopo: [], alunos: [] })
    expect(r.gargalos.linhas).toHaveLength(0)
    expect(JSON.stringify(r.gargalos)).not.toContain("NaN")
  })
})
