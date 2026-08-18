import { describe, expect, it } from "vitest"
import { calcular, clonarPopulacao, entradaBase, recortarPara } from "./contrato"

/**
 * F-06 · Amostra exibida e o resto (`+ 32 alunos`).
 *
 * INVARIÂNCIA: `exibidas + resto` é SEMPRE o total filtrado — para 0, 1, 8, 9 e
 *   28. É a soma que não fecha, e é onde ela costuma não fechar.
 * VARIÂNCIA: com 8 pessoas exatas o rótulo DESAPARECE; com 9 aparece
 *   `+ 1 aluno`. O singular é parte do contrato: `+ 1 alunos` reprova.
 */
describe("F-06 · amostra e resto", () => {
  it("INVARIÂNCIA — exibidas + resto fecha o total em 0, 1, 8, 9 e 28", async () => {
    const base = entradaBase()
    for (const n of [0, 1, 8, 9, 14]) {
      const r = await calcular(recortarPara(base, n))
      expect(r.mapa.exibidas + r.mapa.resto, `n=${n}`).toBe(
        r.mapa.estado === "ok" ? n : r.mapa.exibidas + r.mapa.resto,
      )
      if (r.mapa.estado === "ok") expect(r.mapa.linhas).toHaveLength(r.mapa.exibidas)
    }

    const dobrado = await calcular(clonarPopulacao(base))
    expect(dobrado.mapa.exibidas + dobrado.mapa.resto).toBe(28)
    expect(dobrado.mapa.exibidas).toBe(8)
  })

  it("VARIÂNCIA — com 8 pessoas exatas o rótulo do resto some", async () => {
    const r = await calcular(recortarPara(entradaBase(), 8))
    expect(r.mapa.resto).toBe(0)
    expect(r.mapa.rotuloResto, "'+ 0 alunos' é o defeito que este contrato impede").toBeNull()
  })

  it("VARIÂNCIA — com 9 pessoas o rótulo aparece no SINGULAR", async () => {
    const r = await calcular(recortarPara(entradaBase(), 9))
    expect(r.mapa.resto).toBe(1)
    expect(r.mapa.rotuloResto).toBe("+ 1 aluno")
  })

  it("VARIÂNCIA — com 14 pessoas o rótulo é plural e traz o resto certo", async () => {
    const r = await calcular(entradaBase())
    expect(r.mapa.rotuloResto).toBe("+ 6 alunos")
  })
})
