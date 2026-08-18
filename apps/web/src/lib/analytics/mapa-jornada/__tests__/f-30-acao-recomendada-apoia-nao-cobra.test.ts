import { describe, expect, it } from "vitest"
import { acoesEstaoAtivasNoMapa } from "../index"
import {
  CAPS_A,
  CAP_ANCORA,
  apenas,
  calcular,
  darAtividadeHoje,
  detectarVocabularioPunitivo,
  diasAtras,
  entradaBase,
} from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-30 · A ação recomendada aponta para o MÓDULO, e apoia — não cobra.
 *
 * É a lição 5 da tela anterior, e a mais cara delas: na Visão geral a
 * recomendação mandava cobrar quem já tinha CONCLUÍDO o curso. Número errado é
 * ruim; ação errada sobre pessoa real é pior.
 *
 * INVARIÂNCIA: a ação cita o módulo âncora, não nomeia pessoa, e nenhum termo
 *   da lista proibida aparece na saída INTEIRA da tela.
 * VARIÂNCIA: trocar o âncora troca o módulo citado.
 * CONTROLE NEGATIVO (obrigatório): o detector precisa ACUSAR uma violação
 *   plantada. Sem ele, o teste passa por vacuidade — que é exatamente como a
 *   recomendação de cobrar quem concluiu atravessou a revisão anterior.
 */
function todosAtivos(): EntradaMapaJornada {
  let e = entradaBase()
  for (const alunoId of e.escopo) e = darAtividadeHoje(e, alunoId, CAPS_A[0] as string)
  return { ...e, matriculas: e.matriculas.map((m) => ({ ...m, criadaEmISO: diasAtras(1) })) }
}

describe("F-30 · a ação recomendada apoia, não cobra", () => {
  it("INVARIÂNCIA — a ação cita o módulo âncora e nenhuma pessoa", async () => {
    const r = await calcular(entradaBase())
    const numeroAncora = r.gargalos.linhas[0]?.numero

    expect(r.insights.acao?.moduloId).toBe(CAP_ANCORA)
    expect(r.insights.acao?.texto).toContain(`módulo ${numeroAncora}`)

    // O alvo é o módulo. Nenhum nome de pessoa do roster pode aparecer na ação.
    for (const aluno of entradaBase().alunos) {
      expect(r.insights.acao?.texto, `a ação nomeou ${aluno.nome}`).not.toContain(aluno.nome)
    }
  })

  it("INVARIÂNCIA — vocabulário de apoio, e zero termos punitivos na tela inteira", async () => {
    const r = await calcular(entradaBase())

    expect(detectarVocabularioPunitivo(r)).toEqual([])
    expect(r.insights.acao?.texto).toMatch(/organize|apoio|conversa|lembrete|refor[çc]o|sess[ãa]o/i)
  })

  it("CONTROLE NEGATIVO — o detector acusa uma violação plantada", () => {
    const plantado = {
      insights: {
        acao: {
          texto: "Cobrar as 16 pessoas paradas no módulo 6 e advertir quem tem o pior ritmo.",
        },
      },
    }
    const violacoes = detectarVocabularioPunitivo(plantado)

    expect(violacoes.length, "detector cego aprova qualquer texto").toBeGreaterThan(0)
    expect(violacoes.some((v) => v.detalhe.includes("cobrar"))).toBe(true)
    expect(violacoes.some((v) => v.detalhe.includes("advertir"))).toBe(true)
    expect(violacoes.some((v) => v.detalhe.includes("pior"))).toBe(true)

    // E o controle do controle: um texto legítimo NÃO pode ser acusado.
    expect(
      detectarVocabularioPunitivo({
        texto: "Organize uma sessão de apoio sobre o módulo 6 para destravar o avanço.",
      }),
    ).toEqual([])
  })

  it("VARIÂNCIA — trocar o âncora troca o módulo citado na ação", async () => {
    const antes = await calcular(entradaBase())
    const depois = await calcular(
      apenas(entradaBase(), ["P01", "P02", "P07", "P08", "P09", "P10", "Q1", "Q2", "Q3", "Q4"]),
    )

    expect(antes.insights.acao?.moduloId).toBe(CAP_ANCORA)
    expect(depois.insights.acao?.moduloId).toBe("C2-seguranca-cap2")
    expect(depois.insights.acao?.texto).not.toBe(antes.insights.acao?.texto)
  })

  it("VAZIO — sem concentração não há ação, e nunca uma recomendação de enfeite", async () => {
    const r = await calcular(todosAtivos())

    expect(r.travados.presente).toBe(false)
    expect(r.insights.acao).toBeNull()
  })

  it("GATE — nenhum CTA de escrita sai ativo com o gate desligado", async () => {
    const r = await calcular(entradaBase())

    expect(acoesEstaoAtivasNoMapa()).toBe(false)
    // "Ver recomendações" é navegação. Qualquer CTA que gravasse nasceria
    // `ctaEscreve: true` e teria de ficar inerte enquanto o gate está fechado —
    // o `.env.local` deste repo aponta para PRODUÇÃO.
    expect(r.insights.acao?.ctaEscreve).toBe(false)
  })
})
