import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  apenas,
  calcular,
  darAtividadeHoje,
  diasAtras,
  entradaBase,
  zerarPessoa,
} from "./contrato"
import type { EntradaMapaJornada } from "./contrato"

/**
 * F-31 · Teto de 3 insights, ordem estável, e o vazio do bloco.
 *
 * §28 diz "máximo 3", nunca "exatamente 3". Insight cuja fonte não existe é
 * OMITIDO, não substituído por texto genérico — texto genérico é ruído com cara
 * de conclusão.
 *
 * INVARIÂNCIA: nunca mais de 3; a ordem de emissão é fixa.
 * VARIÂNCIA: três cenários, três contagens (3, 2 e 0). Um bloco que sempre
 *   devolve 3 é a função constante.
 */
function todosAtivos(): EntradaMapaJornada {
  let e = entradaBase()
  for (const alunoId of e.escopo) e = darAtividadeHoje(e, alunoId, CAPS_A[0] as string)
  return { ...e, matriculas: e.matriculas.map((m) => ({ ...m, criadaEmISO: diasAtras(1) })) }
}

/** Ninguém com evidência nenhuma: a jornada não começou. */
function ninguemIniciou(): EntradaMapaJornada {
  let e = apenas(entradaBase(), ["P01", "P02", "P03", "P09", "P10"])
  for (const alunoId of e.escopo) e = zerarPessoa(e, alunoId)
  return e
}

describe("F-31 · teto e vazio dos insights", () => {
  it("INVARIÂNCIA — nunca mais de 3, e a ordem de emissão é fixa", async () => {
    for (const entrada of [entradaBase(), todosAtivos(), apenas(entradaBase(), ["Q1", "Q2"])]) {
      const r = await calcular(entrada)
      expect(r.insights.itens.length).toBeLessThanOrEqual(3)

      const ordem = r.insights.itens.map((i) => i.id)
      // ═══ ORDEM CANÔNICA ATUALIZADA (doutrina do texto, 2026-08-19) ════════
      // Era `concluiu → em-andamento → gargalo`, e nascia da ordem em que o
      // código dava `push`. A nova ordem tem CRITÉRIO escrito: primeiro o que
      // TRAVA a jornada (o único item que aponta um ponto físico do currículo),
      // depois COMO agir sobre quem está em movimento. `concluiu` morreu — era
      // o percentual do tile ao lado, por identidade declarada.
      const canonica = ["gargalo", "em-andamento"]
      expect(ordem, "a ordem tem de ser um prefixo/subsequência da canônica").toEqual(
        canonica.filter((id) => ordem.includes(id)),
      )
    }
  })

  it("VARIÂNCIA — 2 insights com gargalo, 1 sem gargalo", async () => {
    const comGargalo = await calcular(entradaBase())
    const semGargalo = await calcular(todosAtivos())

    expect(comGargalo.insights.itens).toHaveLength(2)
    expect(semGargalo.insights.itens).toHaveLength(1)
    expect(semGargalo.insights.itens.map((i) => i.id)).not.toContain("gargalo")
  })

  it("VAZIO — ninguém iniciou ⇒ bloco vazio, sem-base, zero insights", async () => {
    const r = await calcular(ninguemIniciou())

    expect(r.insights.estado).toBe("vazio")
    expect(r.insights.motivoVazio).toBe("sem-base")
    expect(r.insights.textoVazio).toBe("Ninguém iniciou a jornada neste recorte.")
    expect(r.insights.itens).toHaveLength(0)
    expect(r.insights.acao).toBeNull()
  })

  it("VAZIO — escopo sem ninguém ⇒ sem-escopo, e nunca um percentual sobre nada", async () => {
    const r = await calcular({ ...entradaBase(), escopo: [], alunos: [], matriculas: [] })

    expect(r.insights.estado).toBe("vazio")
    expect(r.insights.motivoVazio).toBe("sem-escopo")
    expect(r.insights.itens).toHaveLength(0)
  })
})
