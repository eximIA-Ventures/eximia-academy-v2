import { entradaFixture } from "@/components/analytics/padroes-tendencias/fixture"
import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"

/**
 * O mundo sintético do preview EXERCITA o motor — não é decoração.
 *
 * Este arquivo NÃO é um dos 44 contratos (o denominador está congelado); é o
 * antídoto de uma vacuidade específica. O modo `?fonte=fixture` existe para o
 * loop comparar pixel com pixel entre rodadas, e uma fixture que deixasse
 * metade dos blocos em estado vazio produziria um screenshot honesto de uma
 * tela vazia — o crítico compararia dois nadas e aprovaria.
 *
 * INVARIÂNCIA: os seis blocos saem em `ok`, com conteúdo.
 * VARIÂNCIA: esvaziar o mundo muda a saída (a montagem não é constante).
 */
describe("a fixture do preview exercita os seis blocos", () => {
  const dados = computePadroesTendencias(entradaFixture())

  it("INVARIÂNCIA — a tela inteira sai em ok, sem falha de leitura", () => {
    expect(dados.estado).toBe("ok")
    expect(dados.erro).toBeNull()
  })

  it("INVARIÂNCIA — os seis blocos têm o que dizer", () => {
    for (const [nome, bloco] of Object.entries({
      mudancas: dados.mudancas,
      serie: dados.serie,
      sinais: dados.sinais,
      gargalos: dados.gargalos,
      participacao: dados.participacao,
      risco: dados.risco,
    })) {
      expect(bloco.estado, `bloco "${nome}" não está em ok`).toBe("ok")
    }
  })

  it("INVARIÂNCIA — cada bloco traz itens, não uma casca vazia", () => {
    expect(dados.mudancas.itens.length).toBeGreaterThan(0)
    expect(dados.serie.pontos.length).toBeGreaterThanOrEqual(2)
    expect(dados.sinais.itens.length).toBeGreaterThan(0)
    expect(dados.gargalos.itens.length).toBeGreaterThan(0)
    expect(dados.participacao.faixas.length).toBe(4)
    expect(dados.risco.categorias.length).toBe(4)
  })

  it("INVARIÂNCIA — a nota de cobertura da §21 é exercitada", () => {
    // O mundo tem concluídos e não iniciados de propósito: sem eles a nota
    // seria `null` e o preview nunca mostraria a correção que ela é.
    expect(dados.risco.notaCobertura).not.toBeNull()
  })

  it("VARIÂNCIA — um mundo sem pessoas produz saída DIFERENTE", () => {
    // Sem este par, "os blocos saem em ok" seria compatível com uma montagem
    // que ignora a entrada e devolve literais.
    const vazio = computePadroesTendencias({ ...entradaFixture(), alunos: [], escopo: [] })
    expect(vazio.estado).not.toBe("ok")
    expect(JSON.stringify(vazio)).not.toBe(JSON.stringify(dados))
  })
})
