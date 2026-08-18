import { describe, expect, it } from "vitest"
import { acoesEstaoAtivas, computePadroesTendencias } from "../index"
import { cenario, cenarioAtivosMais3, cenarioRegularidadeCai } from "./cenario"

/**
 * F-44 · Sete elementos acionáveis, e nenhum escreve.
 *
 * O `.env.local` deste repo aponta para PRODUÇÃO. Um CTA que gravasse não seria
 * um bug de tela, seria escrita em banco de cliente a partir de uma tela de
 * leitura.
 *
 * INVARIÂNCIA: 7 rótulos, todos com `ctaEscreve === false`.
 * VARIÂNCIA: marcar um como `true` na estrutura reprova a asserção — prova que
 *   ela lê o campo e não devolve `true` por construção.
 */

const ROTULOS = [
  "Como ler esta visão",
  "Ver todas as mudanças",
  "Ver detalhes da série histórica",
  "Ver todos os sinais",
  "Ver comparação completa",
  "Ver composição por semana",
  "Ver critérios de classificação",
]

describe("F-44 · CTAs inertes", () => {
  it("INVARIÂNCIA — sete ações, com os literais da spec e do PNG", () => {
    const { acoes } = computePadroesTendencias(cenarioAtivosMais3())
    expect(acoes).toHaveLength(7)
    expect(acoes.map((a) => a.rotulo)).toEqual(ROTULOS)
  })

  it("INVARIÂNCIA — nenhuma ação escreve, em nenhum cenário", () => {
    for (const entrada of [
      cenarioAtivosMais3(),
      cenarioRegularidadeCai(4),
      cenario({ pessoas: [] }),
    ]) {
      for (const acao of computePadroesTendencias(entrada).acoes) {
        expect(acao.ctaEscreve, `${acao.rotulo} escreve`).toBe(false)
      }
    }
  })

  it("VARIÂNCIA — a asserção lê o campo, não devolve verdadeiro por construção", () => {
    const { acoes } = computePadroesTendencias(cenarioAtivosMais3())
    const plantada = { ...acoes[0], ctaEscreve: true }
    expect(plantada.ctaEscreve).toBe(true)
    expect(acoes.every((a) => a.ctaEscreve === false)).toBe(true)
  })

  it("INVARIÂNCIA — as ações são COLETADAS dos blocos, não redigitadas", () => {
    // Uma segunda lista de rótulos divergiria da primeira no dia em que alguém
    // renomeasse um CTA, e o teste que conta 7 continuaria verde apontando para
    // a lista errada.
    const d = computePadroesTendencias(cenarioAtivosMais3())
    expect(d.acoes[1]).toBe(d.mudancas.acao)
    expect(d.acoes[2]).toBe(d.serie.acao)
    expect(d.acoes[3]).toBe(d.sinais.acao)
    expect(d.acoes[4]).toBe(d.gargalos.acao)
    expect(d.acoes[5]).toBe(d.participacao.acao)
    expect(d.acoes[6]).toBe(d.risco.acao)
    expect(d.acoes[0]).toBe(d.moldura.acao)
  })

  it("INVARIÂNCIA — o gate de escrita da casa continua DESLIGADO por padrão", () => {
    expect(acoesEstaoAtivas()).toBe(false)
  })
})
