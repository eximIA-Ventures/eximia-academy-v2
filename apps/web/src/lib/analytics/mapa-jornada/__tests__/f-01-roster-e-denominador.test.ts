import { describe, expect, it } from "vitest"
import { acrescentarPessoa, calcular, entradaBase, recortarPara } from "./contrato"
import { CURSO_A } from "./contrato"

/**
 * F-01 · Total de pessoas do mapa, e o denominador ÚNICO.
 *
 * INVARIÂNCIA: o chip é a cardinalidade do roster, e é O MESMO NÚMERO que serve
 *   de denominador a F-09, F-16 e F-27 — provado por identidade de valor em
 *   três blocos da mesma montagem, não por coincidência numérica.
 * VARIÂNCIA: +1 pessoa move o chip E move os três percentuais. Um mapa que
 *   ignora o roster fica parado nos dois.
 * VAZIO: escopo sem ninguém sai em `sem-escopo`, nunca "0 alunos".
 */
describe("F-01 · roster é o denominador de toda a tela", () => {
  it("INVARIÂNCIA — o chip é a cardinalidade do roster", async () => {
    const r = await calcular(entradaBase())
    expect(r.mapa.totalAlunos).toBe(14)
    expect(r.mapa.totalAlunosLabel).toBe("14 alunos")
    expect(r.contexto.totalAlunos).toBe(r.mapa.totalAlunos)
  })

  it("INVARIÂNCIA — gargalo, distribuição e insight usam o MESMO denominador", async () => {
    const r = await calcular(entradaBase())
    const total = r.mapa.totalAlunos

    const gargalo = r.gargalos.linhas[0]
    expect(gargalo).toBeDefined()
    if (!gargalo) return
    expect(gargalo.pct).toBe(Math.round((gargalo.pessoas / total) * 100))

    const concluidos = r.distribuicao.tiles.find((t) => t.id === "concluidos")
    expect(concluidos).toBeDefined()
    if (!concluidos) return
    expect(concluidos.pct).toBe(Math.round((concluidos.valor / total) * 100))

    const insight = r.insights.itens.find((i) => i.id === "concluiu")
    expect(insight?.texto).toContain(`${concluidos.pct}%`)
  })

  it("VARIÂNCIA — +1 pessoa move o chip E os percentuais", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(
      acrescentarPessoa(entradaBase(), "NOVO", "Zulmira Aparecida", CURSO_A),
    )

    expect(depois.mapa.totalAlunos).toBe(antes.mapa.totalAlunos + 1)
    expect(depois.mapa.totalAlunosLabel).toBe("15 alunos")

    const pctAntes = antes.gargalos.linhas[0]?.pct
    const pctDepois = depois.gargalos.linhas[0]?.pct
    expect(pctDepois, "o percentual do gargalo tem de cair com o denominador maior").not.toBe(
      pctAntes,
    )
  })

  it("VAZIO — escopo sem ninguém não vira '0 alunos'", async () => {
    const r = await calcular(recortarPara(entradaBase(), 0))
    expect(r.mapa.estado).toBe("vazio")
    expect(r.mapa.motivoVazio).toBe("sem-escopo")
    expect(r.mapa.textoVazio).toBe("Não há pessoas neste recorte.")
    expect(r.mapa.totalAlunosLabel).toBe("")
  })
})
