import { describe, expect, it } from "vitest"
import { CAPS_A, calcular, diasAtras, entradaBase } from "./contrato"

const valor = (r: Awaited<ReturnType<typeof calcular>>, id: string) =>
  r.distribuicao.tiles.find((t) => t.id === id)?.valor ?? -1

/**
 * F-15 · Distribuição — Não iniciados (§4: matriculado, nunca iniciou sessão,
 * sem progresso). Todas as células da linha são cinzas.
 *
 * INVARIÂNCIA: três pessoas sem evidência nenhuma na fixture canônica.
 * VARIÂNCIA: UMA reflexão em UM slide qualquer tira a pessoa deste balde.
 */
describe("F-15 · não iniciados", () => {
  it("INVARIÂNCIA — só quem tem a linha inteira cinza conta", async () => {
    const r = await calcular(entradaBase())
    expect(valor(r, "nao-iniciados")).toBe(3)
  })

  it("VARIÂNCIA — uma reflexão tira a pessoa do balde", async () => {
    const base = entradaBase()
    const antes = await calcular(base)
    const depois = await calcular({
      ...base,
      reflexoes: [{ alunoId: "P09", slideId: `${CAPS_A[0]}-s0`, criadaEmISO: diasAtras(3) }],
    })

    expect(valor(depois, "nao-iniciados")).toBe(valor(antes, "nao-iniciados") - 1)
    expect(valor(depois, "em-andamento")).toBe(valor(antes, "em-andamento") + 1)
  })
})
