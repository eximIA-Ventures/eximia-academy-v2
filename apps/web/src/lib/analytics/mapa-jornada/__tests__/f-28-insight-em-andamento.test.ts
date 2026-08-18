import { describe, expect, it } from "vitest"
import { CAPS_A, apenas, calcular, darAtividadeHoje, diasAtras, entradaBase } from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-28 · O insight "em andamento" é o card `Em andamento` (F-13), e os módulos
 * citados são os dois primeiros de F-10.
 *
 * A frase tem DUAS partes com FONTES diferentes: o percentual vem da partição,
 * os módulos vêm do gargalo. As duas precisam variar, senão metade da frase é
 * literal disfarçado de dado.
 *
 * INVARIÂNCIA: percentual idêntico ao tile; módulos citados em ordem ASC.
 * VARIÂNCIA: trocar o conjunto de gargalos troca os módulos citados.
 * VAZIO: com zero gargalos a frase existe SEM a segunda oração — nunca
 *   "módulos undefined a undefined".
 */
function todosAtivos(): EntradaMapaJornada {
  let e = entradaBase()
  for (const alunoId of e.escopo) e = darAtividadeHoje(e, alunoId, CAPS_A[0] as string)
  return { ...e, matriculas: e.matriculas.map((m) => ({ ...m, criadaEmISO: diasAtras(1) })) }
}

const pctDaFrase = (texto: string | undefined): number | null => {
  const m = /(\d+)%/.exec(texto ?? "")
  return m ? Number(m[1]) : null
}

describe("F-28 · insight de em andamento", () => {
  it("INVARIÂNCIA — percentual idêntico ao tile e módulos em ordem ASC", async () => {
    const r = await calcular(entradaBase())
    const frase = r.insights.itens.find((i) => i.id === "em-andamento")
    const tile = r.distribuicao.tiles.find((t) => t.id === "em-andamento")

    expect(pctDaFrase(frase?.texto)).toBe(tile?.pct)

    const doisPrimeiros = r.gargalos.linhas.slice(0, 2).map((g) => g.numero)
    const asc = [...doisPrimeiros].sort((a, b) => a - b)
    expect(doisPrimeiros.length).toBe(2)
    expect(frase?.texto).toContain(`módulos ${asc[0]} a ${asc[1]}`)
  })

  it("VARIÂNCIA — trocar o topo do gargalo troca os módulos citados", async () => {
    const antes = await calcular(entradaBase())
    // Sem P03..P06 o gargalo do módulo 6 desaparece e sobra um só.
    const depois = await calcular(
      apenas(entradaBase(), ["P01", "P02", "P07", "P08", "P09", "P10", "Q1", "Q2", "Q3", "Q4"]),
    )

    const fraseAntes = antes.insights.itens.find((i) => i.id === "em-andamento")
    const fraseDepois = depois.insights.itens.find((i) => i.id === "em-andamento")

    expect(fraseAntes?.texto).toContain("módulos 2 a 6")
    expect(fraseDepois?.texto).toContain("módulo 2")
    expect(fraseDepois?.texto).not.toContain("módulos 2 a 6")
    // O singular é contrato: uma frase com um módulo só não diz "módulos".
    expect(fraseDepois?.texto).toContain("reforço no módulo")
  })

  it("VAZIO — com zero gargalos a segunda oração é OMITIDA, não preenchida com lixo", async () => {
    const r = await calcular(todosAtivos())
    const frase = r.insights.itens.find((i) => i.id === "em-andamento")
    const tile = r.distribuicao.tiles.find((t) => t.id === "em-andamento")

    expect(r.gargalos.linhas).toHaveLength(0)
    expect(frase?.texto).toBe(`${tile?.pct}% estão em andamento.`)
    expect(frase?.texto).not.toContain("undefined")
    expect(frase?.texto).not.toContain("módulo")
  })
})
