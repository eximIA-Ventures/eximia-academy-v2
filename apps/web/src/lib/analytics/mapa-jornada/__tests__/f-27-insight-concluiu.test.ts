import { describe, expect, it } from "vitest"
import { calcular, entradaBase, zerarPessoa } from "./contrato"

/**
 * F-27 · O insight "concluiu a jornada" É o card `Concluídos` (F-12).
 *
 * Mesmo numerador, mesmo denominador. Dois blocos da mesma tela dizendo
 * percentuais diferentes sobre a mesma população é o defeito clássico deste
 * bloco — e não há como o gestor saber qual dos dois acreditar.
 *
 * INVARIÂNCIA: o percentual da frase é IDÊNTICO ao do tile, provado por
 *   identidade na mesma montagem, nunca por coincidência numérica.
 * VARIÂNCIA: mover 1 pessoa para fora de "concluiu" muda a frase E o tile,
 *   juntos.
 */
const pctDaFrase = (texto: string | undefined): number | null => {
  const m = /(\d+)%/.exec(texto ?? "")
  return m ? Number(m[1]) : null
}

describe("F-27 · insight de conclusão", () => {
  it("INVARIÂNCIA — a frase e o tile trazem o MESMO percentual", async () => {
    const r = await calcular(entradaBase())
    const frase = r.insights.itens.find((i) => i.id === "concluiu")
    const tile = r.distribuicao.tiles.find((t) => t.id === "concluidos")

    expect(frase?.texto).toBe(`${tile?.pct}% da equipe já concluiu a jornada.`)
    expect(pctDaFrase(frase?.texto)).toBe(tile?.pct)
  })

  it("ANTI-VACUIDADE — o percentual não é 0 nem 100 na fixture", async () => {
    const r = await calcular(entradaBase())
    const pct = r.distribuicao.tiles.find((t) => t.id === "concluidos")?.pct ?? 0
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })

  it("VARIÂNCIA — tirar 1 concluinte move a frase E o tile, juntos", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(zerarPessoa(entradaBase(), "P01"))

    const tileAntes = antes.distribuicao.tiles.find((t) => t.id === "concluidos")
    const tileDepois = depois.distribuicao.tiles.find((t) => t.id === "concluidos")
    const fraseAntes = antes.insights.itens.find((i) => i.id === "concluiu")
    const fraseDepois = depois.insights.itens.find((i) => i.id === "concluiu")

    expect(tileDepois?.valor).toBe((tileAntes?.valor ?? 0) - 1)
    expect(pctDaFrase(fraseDepois?.texto)).not.toBe(pctDaFrase(fraseAntes?.texto))
    expect(pctDaFrase(fraseDepois?.texto)).toBe(tileDepois?.pct)
  })
})
