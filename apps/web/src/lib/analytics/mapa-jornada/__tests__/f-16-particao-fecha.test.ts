import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CAP_ANCORA,
  type EntradaMapaJornada,
  apenas,
  calcular,
  clonarPopulacao,
  darAtividadeHoje,
  entradaBase,
  entradaUmCurso,
  recortarPara,
  zerarPessoa,
} from "./contrato"

/**
 * F-16 · Percentuais e FECHAMENTO da partição.
 *
 * Este é o contrato mais barato de escrever e o que mais protege. É a lição 4
 * aplicada à tela: ninguém pode cair fora do denominador. Na Visão geral, quatro
 * cards somavam 2 numa base de 6, e as quatro pessoas ausentes eram exatamente
 * as que tinham concluído — a fileira afirmava uma partição que não era.
 *
 * INVARIÂNCIA: em 12 cenários gerados, a soma dos quatro É o roster, e a soma
 *   dos percentuais é 100 (arredondamento com o maior balde absorvendo o resto).
 * VARIÂNCIA: mover 1 pessoa entre dois baldes muda dois números e MANTÉM a
 *   soma. Um balde constante quebra a variância; uma soma que não fecha quebra
 *   a invariância.
 */
function cenarios(): Array<{ nome: string; e: EntradaMapaJornada }> {
  const base = entradaBase()
  return [
    { nome: "base", e: base },
    { nome: "um curso", e: entradaUmCurso() },
    { nome: "dobrado", e: clonarPopulacao(base) },
    { nome: "1 pessoa", e: recortarPara(base, 1) },
    { nome: "2 pessoas", e: recortarPara(base, 2) },
    { nome: "8 pessoas", e: recortarPara(base, 8) },
    { nome: "9 pessoas", e: recortarPara(base, 9) },
    { nome: "só concluídos", e: apenas(base, ["P01", "P02", "Q1"]) },
    { nome: "só travados", e: apenas(base, ["P04", "P05", "P06"]) },
    { nome: "só não iniciados", e: apenas(base, ["P09", "P10", "Q4"]) },
    { nome: "P05 reativada", e: darAtividadeHoje(base, "P05", CAP_ANCORA) },
    { nome: "P01 zerada", e: zerarPessoa(base, "P01") },
  ]
}

describe("F-16 · a partição fecha", () => {
  it("INVARIÂNCIA — em 12 cenários a soma é o roster", async () => {
    for (const { nome, e } of cenarios()) {
      const r = await calcular(e)
      const soma = r.distribuicao.tiles.reduce((a, t) => a + t.valor, 0)
      if (r.distribuicao.tiles.length === 0) {
        expect(r.mapa.totalAlunos, `${nome}: bloco vazio só com roster zero`).toBe(0)
        continue
      }
      expect(soma, `${nome}`).toBe(r.mapa.totalAlunos)
    }
  })

  it("INVARIÂNCIA — os percentuais somam exatamente 100", async () => {
    for (const { nome, e } of cenarios()) {
      const r = await calcular(e)
      if (r.distribuicao.tiles.length === 0) continue
      const soma = r.distribuicao.tiles.reduce((a, t) => a + t.pct, 0)
      expect(soma, `${nome}: ${r.distribuicao.tiles.map((t) => t.pct).join("+")}`).toBe(100)
    }
  })

  it("VARIÂNCIA — mover 1 pessoa muda DOIS números e mantém a soma", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular({
      ...entradaBase(),
      reflexoes: [
        { alunoId: "P09", slideId: `${CAPS_A[0]}-s0`, criadaEmISO: new Date().toISOString() },
      ],
    })

    const par = (r: typeof antes) =>
      r.distribuicao.tiles.map((t) => `${t.id}=${t.valor}`).join(" · ")
    expect(par(depois)).not.toBe(par(antes))

    const soma = (r: typeof antes) => r.distribuicao.tiles.reduce((a, t) => a + t.valor, 0)
    expect(soma(depois)).toBe(soma(antes))
  })

  it("ANTI-VACUIDADE — os quatro baldes não são todos iguais na fixture", async () => {
    const r = await calcular(entradaBase())
    const valores = r.distribuicao.tiles.map((t) => t.valor)
    expect(new Set(valores).size, `valores: ${valores.join(" · ")}`).toBeGreaterThan(1)
  })
})
