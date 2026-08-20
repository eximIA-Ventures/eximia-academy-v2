import { describe, expect, it } from "vitest"
import { TITULOS_A, apenas, calcular, entradaBase } from "./contrato"

/**
 * F-28 · Quem está em movimento está JUNTO ou ESPALHADO?
 *
 * ═══ O QUE ESTE TESTE AFIRMAVA ANTES, E POR QUE MUDOU ═══════════════════════
 * A frase era `${pct}% estão em andamento.` mais um reforço citando "os módulos
 * A a B" — ou seja, o percentual do tile `Em andamento` (F-13) mais os dois
 * primeiros módulos do card de gargalos (F-10). As DUAS metades eram eco de
 * blocos vizinhos da mesma tela, e os módulos saíam por NÚMERO ("módulo 6"),
 * que é um endereço que nenhum gestor tem na cabeça.
 *
 * O item foi reescrito para dizer o que nenhum outro bloco desta aba diz: se as
 * pessoas em andamento estão TODAS NO MESMO MÓDULO ou espalhadas. O fato muda a
 * ação — juntas, uma sessão alcança todas de uma vez; espalhadas, sessão é
 * desperdício e mensagem individual rende mais. Sai de `moduloCorrentePorAluno`,
 * já em memória, sem consulta nova ao banco.
 *
 * ═══ POR QUE A FIXTURE DE CONCENTRAÇÃO PRECISOU SER REFEITA ═════════════════
 * A primeira versão deste teste concentrava a turma com `darAtividadeHoje(...,
 * CAPS_A[0])` para todo o escopo — e ficou VERMELHA, emitindo "distribuídas por
 * 4 módulos diferentes" no cenário que se dizia concentrado. O erro não era do
 * gerador: `moduloCorrentePorAluno` é o PRIMEIRO MÓDULO NÃO CONCLUÍDO da trilha
 * da pessoa (`base.ts`), e `darAtividadeHoje` só acrescenta uma SESSÃO, que não
 * pinta célula nenhuma de "concluído". A fixture prometia um estado que nenhum
 * dado dela produzia; o teste teria passado por vacuidade se a asserção fosse
 * mais frouxa.
 *
 * A concentração agora vem de gente que genuinamente compartilha o módulo
 * corrente: P07 e P08 estão ambos em andamento no módulo 4 (documentado na
 * tabela de `entradaBase`). O par de variância acrescenta P03 — que está no
 * módulo 6 — ao MESMO recorte: um único elemento de diferença entre as duas
 * chamadas, e a frase precisa virar.
 *
 * INVARIÂNCIA: os DOIS LADOS absolutos ("N de M"), o módulo por TÍTULO quando é
 *   um só, e zero percentual (com 6 pessoas, 17 p.p. é uma pessoa).
 * VARIÂNCIA: uma pessoa a mais, num módulo diferente, troca a frase de "todas no
 *   mesmo módulo" para "distribuídas por N módulos diferentes".
 */

/** P07 e P08: ambos em andamento no módulo 4, ativos. Um módulo corrente só. */
const JUNTOS = ["P07", "P08"]

/** Os mesmos dois mais P03, que está no módulo 6. Dois módulos correntes. */
const ESPALHADOS = ["P03", "P07", "P08"]

const MODULO_DE_P07_P08 = TITULOS_A[3] as string

describe("F-28 · dispersão de quem está em andamento", () => {
  it("INVARIÂNCIA — publica os dois lados absolutos e nenhum percentual", async () => {
    const r = await calcular(entradaBase())
    const frase = r.insights.itens.find((i) => i.id === "em-andamento")
    const tile = r.distribuicao.tiles.find((t) => t.id === "em-andamento")

    expect(frase, "sem o item o teste seria vácuo").toBeDefined()
    expect(frase?.texto).toContain(`de ${r.mapa.totalAlunos}`)
    expect(frase?.texto, "percentual em base pequena amplia; a contagem informa").not.toMatch(
      /\d+%/,
    )
    // O tile continua sendo quem publica o percentual — um caminho só.
    expect(tile?.pct).toBeGreaterThan(0)
  })

  it("INVARIÂNCIA — módulo pelo TÍTULO, jamais pelo número", async () => {
    const r = await calcular(apenas(entradaBase(), JUNTOS))
    const frase = r.insights.itens.find((i) => i.id === "em-andamento")

    // CONTROLE POSITIVO ancorado no defeito: com menos de duas pessoas em
    // andamento a frase sairia no singular ("no módulo X") e passaria sem nunca
    // exercitar o ramo da concentração.
    expect(
      r.distribuicao.tiles.find((t) => t.id === "em-andamento")?.valor,
      "o ramo 'todas no mesmo módulo' exige ao menos duas pessoas",
    ).toBe(2)

    expect(frase?.texto).toContain("todas no mesmo módulo")
    expect(frase?.texto).toContain(MODULO_DE_P07_P08)
    expect(frase?.texto).not.toMatch(/m[óo]dulo \d/i)
    expect(frase?.texto).not.toContain("undefined")
  })

  it("VARIÂNCIA — uma pessoa num módulo diferente troca a frase", async () => {
    const juntos = await calcular(apenas(entradaBase(), JUNTOS))
    const espalhados = await calcular(apenas(entradaBase(), ESPALHADOS))

    const fraseJuntos = juntos.insights.itens.find((i) => i.id === "em-andamento")
    const fraseEspalhados = espalhados.insights.itens.find((i) => i.id === "em-andamento")

    expect(fraseJuntos?.texto).toContain("todas no mesmo módulo")
    expect(fraseEspalhados?.texto).toContain("módulos diferentes")
    expect(fraseEspalhados?.texto).not.toBe(fraseJuntos?.texto)
  })
})
