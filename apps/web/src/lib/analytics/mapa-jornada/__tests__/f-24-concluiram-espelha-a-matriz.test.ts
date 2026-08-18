import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, diasAtras, entradaBase, recortarPara } from "./contrato"
import type { SaidaMapa } from "./contrato"

/**
 * F-24 · "Concluíram" é contagem DA MATRIZ: só as células verdes.
 *
 * INVARIÂNCIA: `concluiram(m)` = nº de células verdes da coluna `m`,
 *   célula a célula.
 * VARIÂNCIA ASSIMÉTRICA (o teste que importa): virar uma célula laranja em
 *   verde sobe `Concluíram` em 1 e NÃO mexe em `Iniciaram` — que já a contava.
 *   Quem implementou as duas colunas com a mesma condição passa em F-23,
 *   passa na invariância daqui, e reprova exatamente aqui.
 */
function celulasVerdesDaColuna(r: SaidaMapa, moduloId: string): number {
  const indice = r.mapa.colunas.findIndex((c) => c.id === moduloId)
  if (indice < 0) return -1
  return r.mapa.linhas.filter((l) => l.celulas[indice] === "concluido").length
}

describe("F-24 · Concluíram espelha a matriz", () => {
  it("INVARIÂNCIA — coluna a coluna, `Concluíram` é a contagem de células verdes", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))

    expect(r.funil.linhas.length).toBeGreaterThan(0)
    for (const linha of r.funil.linhas) {
      expect(linha.concluiram, `módulo ${linha.moduloId}`).toBe(
        celulasVerdesDaColuna(r, linha.moduloId),
      )
    }
  })

  it("ANTI-VACUIDADE — `Concluíram` e `Iniciaram` não são iguais em toda linha", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))
    expect(
      r.funil.linhas.some((l) => l.concluiram !== l.iniciaram),
      "se as duas colunas coincidissem em toda linha, a mesma condição serviria às duas",
    ).toBe(true)
  })

  it("VARIÂNCIA ASSIMÉTRICA — laranja→verde sobe Concluíram e NÃO move Iniciaram", async () => {
    const base = recortarPara(entradaBase(), 8)
    const antes = await calcular(base)

    // P03 já tem sessão no módulo âncora: a célula é laranja e ele já entra em
    // `Iniciaram`. Chegar ao fim dos slides a torna verde, e só isso.
    const depois = await calcular({
      ...base,
      percorrido: [
        ...(base.percorrido ?? []),
        {
          alunoId: "P03",
          capituloId: CAP_ANCORA,
          maxSlideIndex: 3,
          slidesTotalNaPassagem: 4,
          chegouAoFimISO: diasAtras(1),
          ultimaVistaISO: diasAtras(1),
        },
      ],
    })

    const a = antes.funil.linhas.find((l) => l.moduloId === CAP_ANCORA)
    const d = depois.funil.linhas.find((l) => l.moduloId === CAP_ANCORA)

    expect(d?.concluiram).toBe((a?.concluiram ?? 0) + 1)
    expect(
      d?.iniciaram,
      "quem conclui já estava contado em Iniciaram: a coluna não pode subir junto",
    ).toBe(a?.iniciaram)
  })
})
