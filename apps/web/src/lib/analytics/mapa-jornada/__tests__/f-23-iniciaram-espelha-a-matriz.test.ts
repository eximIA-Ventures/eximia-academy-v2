import { describe, expect, it } from "vitest"
import { CAPS_B, CURSO_B, calcular, diasAtras, entradaBase, recortarPara } from "./contrato"
import type { SaidaMapa } from "./contrato"

/**
 * F-23 · "Iniciaram" é contagem DA MATRIZ, célula a célula.
 *
 * O funil e o mapa estão lado a lado na mesma tela. Se discordarem, um dos dois
 * está mentindo — e o gestor não tem como saber qual. Por isso a asserção é
 * célula a célula, nunca contra um número mágico.
 *
 * A fixture é recortada para 8 pessoas de propósito: `AMOSTRA_LINHAS` é 8, e só
 * com o roster inteiro visível a contagem da matriz é auditável a partir da
 * saída. Comparar contra uma amostra cortada compararia coisas diferentes.
 *
 * INVARIÂNCIA: `iniciaram(m)` = nº de células não-cinzas da coluna `m`.
 * VARIÂNCIA: virar uma célula cinza em laranja sobe `Iniciaram` daquele módulo
 *   em 1 e não move nenhum outro.
 */
function celulasNaoCinzasDaColuna(r: SaidaMapa, moduloId: string): number {
  const indice = r.mapa.colunas.findIndex((c) => c.id === moduloId)
  if (indice < 0) return -1
  return r.mapa.linhas.filter((l) => l.celulas[indice] !== "nao-iniciado").length
}

describe("F-23 · Iniciaram espelha a matriz", () => {
  it("ANTI-VACUIDADE — o recorte mostra o roster inteiro (nada cortado)", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))
    expect(r.mapa.exibidas).toBe(r.contexto.totalAlunos)
    expect(r.mapa.resto).toBe(0)
    expect(r.mapa.linhas).toHaveLength(8)
  })

  it("INVARIÂNCIA — coluna a coluna, `Iniciaram` é a contagem de células não-cinzas", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))

    expect(r.funil.linhas.length).toBeGreaterThan(0)
    for (const linha of r.funil.linhas) {
      expect(
        linha.iniciaram,
        `módulo ${linha.moduloId}: o funil discorda do mapa ao lado dele`,
      ).toBe(celulasNaoCinzasDaColuna(r, linha.moduloId))
    }
  })

  it("ANTI-VACUIDADE — as colunas não têm todas o mesmo `Iniciaram`", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))
    expect(
      new Set(r.funil.linhas.map((l) => l.iniciaram)).size,
      "uma fixture em que todo módulo dá o mesmo número é satisfeita por qualquer função",
    ).toBeGreaterThan(1)
  })

  it("VARIÂNCIA — uma célula cinza que vira laranja sobe só aquele módulo", async () => {
    // O alvo é o PRIMEIRO módulo de um curso, e a escolha é técnica: o piso
    // cumulativo por evidência eleva os módulos ANTERIORES do mesmo curso.
    // Plantar a evidência num módulo do meio moveria várias colunas de uma vez
    // e o teste não conseguiria afirmar isolamento. No primeiro módulo não há
    // anterior, então o delta é de uma coluna só.
    const comMatricula = {
      ...recortarPara(entradaBase(), 8),
      matriculas: [
        ...recortarPara(entradaBase(), 8).matriculas,
        {
          alunoId: "P05",
          cursoId: CURSO_B,
          status: "active" as const,
          criadaEmISO: diasAtras(300),
        },
      ],
    }
    const antes = await calcular(comMatricula)

    const alvo = CAPS_B[0] as string
    const depois = await calcular({
      ...comMatricula,
      sessoes: [
        ...(comMatricula.sessoes ?? []),
        { alunoId: "P05", capituloId: alvo, criadaEmISO: diasAtras(1) },
      ],
    })

    const linhaAntes = antes.funil.linhas.find((l) => l.moduloId === alvo)
    const linhaDepois = depois.funil.linhas.find((l) => l.moduloId === alvo)
    expect(linhaDepois?.iniciaram).toBe((linhaAntes?.iniciaram ?? 0) + 1)

    for (const l of depois.funil.linhas) {
      if (l.moduloId === alvo) continue
      const par = antes.funil.linhas.find((x) => x.moduloId === l.moduloId)
      expect(l.iniciaram, `módulo ${l.moduloId} não deveria ter se movido`).toBe(par?.iniciaram)
    }
  })
})
