// ---------------------------------------------------------------------------
// O gate da IA reprova o número inventado — e o teste PROVA que ele reprova.
// ---------------------------------------------------------------------------
// Um detector que nunca reprova passa em qualquer suíte e não defende nada. Por
// isso o CONTROLE POSITIVO vem primeiro aqui: um texto com aritmética inventada
// tem que sair `ok: false`. Só depois disso os casos de aprovação significam
// alguma coisa — sem ele, "aprovou o texto honesto" seria indistinguível de
// "aprova tudo".
//
// O número inventado dos casos abaixo é o modo de falha REAL do modelo nesta
// tela: ele recebe "31 antes, 24 agora" e escreve "uma queda de 23%". O 23 nunca
// foi calculado por ninguém desta casa.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import type { LeituraAssistida } from "../tipos"
import { conferirNumeros, numerosDoTexto, numerosPermitidos } from "../verificacao"

const LEITURA: LeituraAssistida = {
  fatos: [
    { rotulo: "Pessoas ativas no período", valor: "24" },
    { rotulo: "Pessoas ativas no período anterior", valor: "31" },
    { rotulo: "Variação de pessoas ativas", valor: "−7" },
    { rotulo: "Regularidade atual", valor: "62%" },
    { rotulo: "Variação da regularidade", valor: "−4 p.p." },
    { rotulo: "Módulo de maior queda", valor: "Segurança no transporte" },
  ],
  leituraDeterministica:
    "A ativação caiu de 31 para 24 pessoas. A regularidade caiu 4 p.p., para 62%.",
  acaoDeterministica: "Verifique quais grupos deixaram de acessar antes de agir por pessoa.",
  periodoDias: 30,
  totalRecorte: 45,
}

describe("o gate numérico da leitura assistida", () => {
  // ═══ CONTROLE POSITIVO — sem isto, nada abaixo prova coisa alguma ═══
  it("CONTROLE POSITIVO — reprova a porcentagem que o modelo calculou sozinho", () => {
    const inventado =
      "A ativação caiu de 31 para 24 pessoas, uma queda de 23%, com a regularidade em 62%."
    const veredicto = conferirNumeros(inventado, LEITURA)

    expect(veredicto.ok).toBe(false)
    expect(veredicto.inventados).toContain("23")
  })

  it("CONTROLE POSITIVO — reprova número plausível que ninguém calculou", () => {
    // 7 pessoas deixaram de acessar (isso existe: −7). "em média 2 dias" não.
    const veredicto = conferirNumeros(
      "As 7 pessoas que saíram ficaram em média 2 dias sem acessar.",
      LEITURA,
    )
    expect(veredicto.ok).toBe(false)
    expect(veredicto.inventados).toContain("2")
  })

  it("aprova o texto que só reusa números da camada de dados", () => {
    const honesto =
      "O time perdeu ritmo no período: de 31 pessoas ativas passou a 24, e a regularidade " +
      "cedeu 4 p.p., ficando em 62%. A queda se concentra em Segurança no transporte."
    expect(conferirNumeros(honesto, LEITURA)).toEqual({ ok: true, inventados: [] })
  })

  it("aprova texto sem número nenhum", () => {
    expect(
      conferirNumeros("O time perdeu ritmo, e a queda se concentra num módulo.", LEITURA).ok,
    ).toBe(true)
  })

  it("o número de contexto do recorte é permitido (período e total)", () => {
    expect(
      conferirNumeros("Nos últimos 30 dias, entre as 45 pessoas do recorte.", LEITURA).ok,
    ).toBe(true)
  })
})

describe("normalização — o mesmo número escrito de outro jeito não vira divergência", () => {
  it("separador de milhar não cria número novo", () => {
    const leitura: LeituraAssistida = {
      ...LEITURA,
      fatos: [{ rotulo: "Sessões no período", valor: "1234" }],
      leituraDeterministica: "Foram 1234 sessões.",
    }
    expect(conferirNumeros("Foram 1.234 sessões no período.", leitura).ok).toBe(true)
  })

  it("decimal com vírgula e com ponto são o mesmo número", () => {
    const leitura: LeituraAssistida = {
      ...LEITURA,
      fatos: [{ rotulo: "Sessões por pessoa", valor: "4.5" }],
      leituraDeterministica: "Média de 4.5 sessões por pessoa.",
    }
    expect(conferirNumeros("Cada pessoa fez 4,5 sessões em média.", leitura).ok).toBe(true)
  })

  it("pontuação de fim de frase não gruda no número", () => {
    expect(numerosDoTexto("Ativos: 24. Anteriores: 31,")).toEqual(["24", "31"])
  })

  it("porcentagem e p.p. entregam o número limpo", () => {
    expect(numerosDoTexto("caiu 4 p.p., para 62%")).toEqual(["4", "62"])
  })
})

describe("o conjunto permitido é fechado — só o que a camada de dados produziu", () => {
  it("inclui os valores dos fatos e os números da frase da regra", () => {
    const permitidos = numerosPermitidos(LEITURA)
    for (const esperado of ["24", "31", "7", "62", "4", "30", "45"]) {
      expect(permitidos.has(esperado)).toBe(true)
    }
  })

  it("NÃO inclui um número que só existiria por aritmética do modelo", () => {
    // 31 − 24 = 7 está na lista (a camada calculou). 24/31 ⇒ 23% NÃO está.
    expect(numerosPermitidos(LEITURA).has("23")).toBe(false)
  })
})
