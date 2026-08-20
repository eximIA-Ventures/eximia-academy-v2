import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, darAtividadeHoje, entradaBase } from "./contrato"

const ORDEM_FIXA = ["todos", "perdendo-ritmo", "parados", "nao-iniciaram", "sustentando"]

/**
 * F-07 · Contagem por filtro interno (§23), taxonomia idêntica nas três telas.
 *
 * INVARIÂNCIA 1: `Todos` é F-01, por construção.
 * INVARIÂNCIA 2: a ordem dos chips é FIXA, nunca ordenada por tamanho — é a
 *   correção D-19 que a Visão geral já levou. Um chip que muda de lugar quando
 *   o número muda faz o gestor procurar o mesmo filtro em posições diferentes.
 * ANTI-VACUIDADE: pelo menos três filtros nomeados têm contagem DIFERENTE de
 *   zero e diferente entre si — senão `() => 0` passaria em tudo.
 * VARIÂNCIA: dar atividade de hoje a uma pessoa parada tira 1 de `Parados`.
 */
describe("F-07 · filtros internos", () => {
  it("INVARIÂNCIA — `Todos` é a cardinalidade do roster", async () => {
    const r = await calcular(entradaBase())
    const todos = r.mapa.filtros.find((f) => f.id === "todos")
    expect(todos?.total).toBe(r.mapa.totalAlunos)
  })

  it("INVARIÂNCIA — a ordem dos chips não depende dos tamanhos", async () => {
    const normal = await calcular(entradaBase())
    expect(normal.mapa.filtros.map((f) => f.id)).toEqual(ORDEM_FIXA)

    const mexido = await calcular(darAtividadeHoje(entradaBase(), "P05", CAP_ANCORA))
    expect(mexido.mapa.filtros.map((f) => f.id)).toEqual(ORDEM_FIXA)
  })

  it("ANTI-VACUIDADE — os filtros nomeados não são todos iguais", async () => {
    const r = await calcular(entradaBase())
    const nomeados = r.mapa.filtros.filter((f) => f.id !== "todos").map((f) => f.total)
    expect(new Set(nomeados).size, `contagens: ${nomeados.join(" · ")}`).toBeGreaterThanOrEqual(3)
  })

  it("INVARIÂNCIA — os nomeados nunca somam mais que `Todos`", async () => {
    const r = await calcular(entradaBase())
    const soma = r.mapa.filtros.filter((f) => f.id !== "todos").reduce((acc, f) => acc + f.total, 0)
    // Os dois estados sem chip (`Concluído` e `Retomando`) explicam a folga —
    // é a mesma cobertura que a Visão geral teve de publicar.
    expect(soma).toBeLessThanOrEqual(r.mapa.totalAlunos)
  })

  it("VARIÂNCIA — atividade de hoje tira 1 de `Parados`", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(darAtividadeHoje(entradaBase(), "P05", CAP_ANCORA))

    const parados = (r: typeof antes) => r.mapa.filtros.find((f) => f.id === "parados")?.total ?? 0
    expect(depois && parados(depois)).toBe(parados(antes) - 1)
  })
})
