import { describe, expect, it } from "vitest"
import { CAPS_A, calcular, entradaBase, recortarPara, zerarPessoa } from "./contrato"

/**
 * F-25 · Conversão = concluíram ÷ chegaram, arredondado HALF-UP.
 *
 * A §27 exemplifica `40 / 37 / 33 → 83%`. 33/40 = 82,5% — arredondado para 83,
 * não truncado para 82. O caso de arredondamento É o teste: uma implementação
 * com `Math.floor` passa em toda linha exata e reprova só aqui.
 *
 * INVARIÂNCIA: toda linha satisfaz `pct = round(concluíram/chegaram × 100)`.
 * VARIÂNCIA (duas, uma por operando): subir `Concluíram` sobe a conversão;
 *   subir `Chegaram` a derruba.
 * VAZIO: `Chegaram = 0` ⇒ travessão, nunca `0%` nem `NaN`.
 */
describe("F-25 · Conversão", () => {
  it("INVARIÂNCIA — a razão bate em toda linha, e o rótulo acompanha", async () => {
    const r = await calcular(entradaBase())

    expect(r.funil.linhas.length).toBeGreaterThan(0)
    for (const l of r.funil.linhas) {
      const esperado = Math.round((l.concluiram / l.chegaram) * 100)
      expect(l.conversaoPct, `módulo ${l.moduloId}`).toBe(esperado)
      expect(l.conversaoLabel).toBe(`${esperado}%`)
    }
  })

  it("INVARIÂNCIA — half-up: 1 de 8 é 13%, não 12%", async () => {
    // Sem P02, o módulo 7 fica com 1 concluinte em 8 matriculados: 12,5%.
    // Truncamento devolveria 12. É o mesmo caso do 82,5% → 83% da §27.
    const r = await calcular(zerarPessoa(recortarPara(entradaBase(), 8), "P02"))
    const modulo7 = r.funil.linhas.find((l) => l.moduloId === CAPS_A[6])

    expect(modulo7?.concluiram).toBe(1)
    expect(modulo7?.chegaram).toBe(8)
    expect(modulo7?.conversaoPct, "12,5% arredonda para 13, não trunca para 12").toBe(13)
  })

  it("VARIÂNCIA (a) — subir Concluíram sobe a conversão", async () => {
    const base = recortarPara(entradaBase(), 8)
    const antes = await calcular(base)
    const depois = await calcular(zerarPessoa(base, "P02"))

    const a = antes.funil.linhas.find((l) => l.moduloId === CAPS_A[6])
    const d = depois.funil.linhas.find((l) => l.moduloId === CAPS_A[6])

    expect(d?.concluiram).toBeLessThan(a?.concluiram ?? 0)
    expect(d?.conversaoPct ?? 0).toBeLessThan(a?.conversaoPct ?? 0)
  })

  it("VARIÂNCIA (b) — subir Chegaram, sem mexer em Concluíram, derruba a conversão", async () => {
    const base = recortarPara(entradaBase(), 8)
    const antes = await calcular(base)
    // Uma pessoa a mais matriculada no curso A, sem evidência nenhuma: o
    // denominador sobe e o numerador não.
    const depois = await calcular({
      ...base,
      escopo: [...base.escopo, "Z9"],
      alunos: [...base.alunos, { id: "Z9", nome: "Zeca Nogueira" }],
      matriculas: [
        ...base.matriculas,
        {
          alunoId: "Z9",
          cursoId: "C1-solucao-de-problemas",
          status: "active" as const,
          criadaEmISO: "2025-10-21T10:00:00.000Z",
        },
      ],
    })

    const a = antes.funil.linhas.find((l) => l.moduloId === CAPS_A[0])
    const d = depois.funil.linhas.find((l) => l.moduloId === CAPS_A[0])

    expect(d?.chegaram).toBe((a?.chegaram ?? 0) + 1)
    expect(d?.concluiram).toBe(a?.concluiram)
    expect(d?.conversaoPct ?? 0).toBeLessThan(a?.conversaoPct ?? 0)
  })

  it("VAZIO — nenhuma conversão sai como `NaN` ou string vazia", async () => {
    const r = await calcular(entradaBase())
    for (const l of r.funil.linhas) {
      expect(Number.isNaN(l.conversaoPct as number)).toBe(false)
      expect(l.conversaoLabel).not.toBe("")
      expect(l.conversaoLabel).not.toContain("NaN")
    }
  })
})
