import { describe, expect, it } from "vitest"
import { CAPS_A, calcular, entradaBase } from "./contrato"

/**
 * F-12 · Distribuição — Concluídos.
 *
 * Critério de CÉLULA, não `enrollments.status='completed'`: achado A-4, aquele
 * status é autodeclaração pelo botão "Módulo Concluído" e vale `{}` nas linhas
 * reais de produção.
 *
 * INVARIÂNCIA: pessoa com 7 de 7 verdes conta; com 6 de 7, não.
 * VARIÂNCIA: tirar a conclusão do último módulo de uma pessoa move 1 de
 *   `Concluídos` para outro balde, sem mudar o total.
 */
const valor = (r: Awaited<ReturnType<typeof calcular>>, id: string) =>
  r.distribuicao.tiles.find((t) => t.id === id)?.valor ?? -1

describe("F-12 · concluídos", () => {
  it("INVARIÂNCIA — só quem tem a linha inteira verde conta", async () => {
    const r = await calcular(entradaBase())
    expect(valor(r, "concluidos")).toBe(3)
  })

  it("VARIÂNCIA — 6 de 7 verdes não conta", async () => {
    const base = entradaBase()
    const semUltimo = {
      ...base,
      percorrido: (base.percorrido ?? []).filter(
        (p) => !(p.alunoId === "P01" && p.capituloId === CAPS_A[6]),
      ),
    }
    const r = await calcular(semUltimo)
    expect(valor(r, "concluidos")).toBe(2)
    expect(r.mapa.totalAlunos, "o total do roster não se move").toBe(14)
  })

  it("VARIÂNCIA — a pessoa removida reaparece em OUTRO balde, nunca some", async () => {
    const base = entradaBase()
    const semUltimo = {
      ...base,
      percorrido: (base.percorrido ?? []).filter(
        (p) => !(p.alunoId === "P01" && p.capituloId === CAPS_A[6]),
      ),
    }
    const antes = await calcular(base)
    const depois = await calcular(semUltimo)

    const soma = (r: typeof antes) => r.distribuicao.tiles.reduce((a, t) => a + t.valor, 0)
    expect(soma(depois)).toBe(soma(antes))
  })
})
