import { describe, expect, it } from "vitest"
import { CAPS_A, apenas, calcular, diasAtras, entradaUmCurso } from "./contrato"

const valor = (r: Awaited<ReturnType<typeof calcular>>, id: string) =>
  r.distribuicao.tiles.find((t) => t.id === id)?.valor ?? -1

/**
 * F-14 · Distribuição — Travados (§4 "Parado": sem atividade há 14+ dias).
 *
 * O LIMIAR É `>`, NÃO `>=`, espelhando `student-triage.ts:73`. É a diferença de
 * um dia, e é a única forma de provar que o número não foi escrito à mão.
 *
 * INVARIÂNCIA: 15 dias sem atividade conta; 14 não.
 * VARIÂNCIA: o par 14/15 É a variância — um dia move o número.
 */
async function comAtividadeHa(dias: number) {
  const base = apenas(entradaUmCurso(), ["P01", "P09"])
  return calcular({
    ...base,
    sessoes: [{ alunoId: "P09", capituloId: CAPS_A[0] as string, criadaEmISO: diasAtras(dias) }],
  })
}

describe("F-14 · travados e o limiar de 14 dias", () => {
  it("INVARIÂNCIA — 14 dias NÃO conta como travado", async () => {
    const r = await comAtividadeHa(14)
    expect(valor(r, "travados")).toBe(0)
    expect(valor(r, "em-andamento")).toBe(1)
  })

  it("VARIÂNCIA — 15 dias JÁ conta como travado", async () => {
    const r = await comAtividadeHa(15)
    expect(valor(r, "travados")).toBe(1)
    expect(valor(r, "em-andamento")).toBe(0)
  })

  it("INVARIÂNCIA — o total não se move entre os dois casos", async () => {
    const a = await comAtividadeHa(14)
    const b = await comAtividadeHa(15)
    const soma = (r: typeof a) => r.distribuicao.tiles.reduce((acc, t) => acc + t.valor, 0)
    expect(soma(a)).toBe(soma(b))
    expect(soma(a)).toBe(a.mapa.totalAlunos)
  })
})
