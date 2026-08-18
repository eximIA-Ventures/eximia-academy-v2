import { describe, expect, it } from "vitest"
import { CURSO_A, acrescentarPessoa, calcular, entradaBase, entradaUmCurso } from "./contrato"

/**
 * F-22 · Coluna "Chegaram" — a constante que é FATO, não bug.
 *
 * Achado A-2: não existe travamento sequencial de capítulo. Toda pessoa
 * matriculada alcança todo módulo, logo `chegaram(m)` é o número de
 * matriculados no curso de `m` — o `40` repetido nas sete linhas do PNG.
 *
 * INVARIÂNCIA: com um curso só, todas as linhas têm o MESMO `Chegaram`, igual
 *   ao roster; e a nota de régua existe em campo obrigatório, não vazia.
 * VARIÂNCIA (a): matricular uma pessoa a mais sobe TODAS as linhas do curso.
 * VARIÂNCIA (b): com dois cursos de tamanhos diferentes, as linhas de cada
 *   curso têm valores DIFERENTES. Esta é a única entrada capaz de separar a
 *   implementação correta de `() => 40` — sem ela, F-22 seria satisfeito por
 *   uma constante, que é a lição 1.
 */
describe("F-22 · Chegaram", () => {
  it("INVARIÂNCIA — com um curso só, todas as linhas trazem o roster inteiro", async () => {
    const r = await calcular(entradaUmCurso())
    const valores = new Set(r.funil.linhas.map((l) => l.chegaram))

    expect(r.funil.linhas.length).toBeGreaterThan(0)
    expect(valores.size, "um curso só ⇒ uma única cardinalidade").toBe(1)
    expect([...valores][0]).toBe(r.contexto.totalAlunos)
  })

  it("INVARIÂNCIA — a nota de régua está na saída, em campo obrigatório", async () => {
    const r = await calcular(entradaBase())

    expect(typeof r.funil.notaRegua).toBe("string")
    expect(r.funil.notaRegua.length).toBeGreaterThan(40)
    // A régua tem de dizer as duas coisas: que não há liberação sequencial, e o
    // que "Chegaram" passa a significar por causa disso.
    expect(r.funil.notaRegua).toContain("sequência")
    expect(r.funil.notaRegua).toContain("Chegaram")
  })

  it("VARIÂNCIA (a) — matricular uma pessoa sobe TODAS as linhas do curso", async () => {
    const antes = await calcular(entradaUmCurso())
    const depois = await calcular(acrescentarPessoa(entradaUmCurso(), "N1", "Nova Pessoa", CURSO_A))
    const antesValor = antes.funil.linhas[0]?.chegaram ?? 0

    expect(depois.funil.linhas.every((l) => l.chegaram === antesValor + 1)).toBe(true)
  })

  it("VARIÂNCIA (b) — dois cursos de tamanhos diferentes ⇒ dois valores", async () => {
    const r = await calcular(entradaBase())
    const doCursoA = r.funil.linhas.filter((l) => l.moduloId.startsWith("C1-"))
    const doCursoB = r.funil.linhas.filter((l) => l.moduloId.startsWith("C2-"))

    expect(doCursoA.length).toBeGreaterThan(0)
    expect(doCursoB.length).toBeGreaterThan(0)
    expect(new Set(doCursoA.map((l) => l.chegaram)).size).toBe(1)
    expect(new Set(doCursoB.map((l) => l.chegaram)).size).toBe(1)
    expect(
      doCursoA[0]?.chegaram,
      "se os dois cursos derem o mesmo número, `() => constante` passaria neste teste",
    ).not.toBe(doCursoB[0]?.chegaram)
  })

  it("VAZIO — nenhuma linha renderizada com `Chegaram` zero", async () => {
    const r = await calcular(entradaBase())
    expect(r.funil.linhas.filter((l) => l.chegaram === 0)).toEqual([])
  })
})
