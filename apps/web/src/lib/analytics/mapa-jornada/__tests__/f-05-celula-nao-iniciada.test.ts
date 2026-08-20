import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  apenas,
  calcular,
  diasAtras,
  entradaBase,
  entradaUmCurso,
  zerarPessoa,
} from "./contrato"

/**
 * F-05 · Estado da célula — NÃO INICIADO (cinza), e a régua publicada.
 *
 * INVARIÂNCIA 1: par sem NENHUMA das três evidências é cinza.
 * INVARIÂNCIA 2 (a que mais importa): a régua do cinza está em `textoRodape`,
 *   campo OBRIGATÓRIO do tipo. A §31 define cinza como "não iniciado, AUSÊNCIA
 *   DE DADO, estado neutro" — as duas coisas na mesma cor. Sem a régua na tela,
 *   o gestor lê falta de instrumentação como falta de esforço da pessoa. Campo
 *   opcional deixaria esse fix sumir sem quebrar nada (lição 3).
 * VARIÂNCIA: uma reflexão num slide do capítulo tira o cinza.
 */
describe("F-05 · célula não iniciada e a régua do cinza", () => {
  it("INVARIÂNCIA — sem evidência nenhuma, a linha inteira é cinza", async () => {
    const r = await calcular(apenas(entradaUmCurso(), ["P01", "P09"]))
    const linha = r.mapa.linhas.find((l) => l.alunoId === "P09")
    expect(linha?.celulas.every((c) => c === "nao-iniciado")).toBe(true)
  })

  it("INVARIÂNCIA — a régua do cinza é renderizada, e é obrigatória", async () => {
    const r = await calcular(entradaBase())
    expect(r.mapa.textoRodape.length).toBeGreaterThan(0)
    expect(r.mapa.textoRodape.toLowerCase()).toContain("cinza")
    // A ambiguidade tem de estar DITA, não implícita: as duas leituras.
    expect(r.mapa.textoRodape.toLowerCase()).toContain("não tenha iniciado")
    expect(r.mapa.textoRodape.toLowerCase()).toContain("não tenha sido registrada")
  })

  it("VARIÂNCIA — uma reflexão tira o cinza da célula", async () => {
    const base = apenas(entradaUmCurso(), ["P01", "P09"])
    const celulaDeP09 = (r: Awaited<ReturnType<typeof calcular>>) =>
      r.mapa.linhas.find((l) => l.alunoId === "P09")?.celulas[2]

    expect(celulaDeP09(await calcular(base))).toBe("nao-iniciado")

    const depois = await calcular({
      ...base,
      reflexoes: [{ alunoId: "P09", slideId: `${CAPS_A[2]}-s1`, criadaEmISO: diasAtras(5) }],
    })
    expect(celulaDeP09(depois)).not.toBe("nao-iniciado")
  })

  it("VAZIO — ninguém iniciou nada ⇒ texto explícito, sem linha nenhuma", async () => {
    let e = entradaUmCurso()
    for (const alunoId of e.escopo) e = zerarPessoa(e, alunoId)
    const r = await calcular(e)

    expect(r.mapa.estado).toBe("vazio")
    expect(r.mapa.motivoVazio).toBe("sem-base")
    expect(r.mapa.textoVazio).toBe("Ninguém iniciou a jornada neste recorte.")
  })
})
