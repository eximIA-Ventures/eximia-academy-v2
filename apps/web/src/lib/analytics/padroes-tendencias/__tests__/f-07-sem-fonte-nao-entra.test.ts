import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenarioAtivosMais3, cenarioModulos, cenarioRegularidadeCai, serializar } from "./cenario"
import {
  DIR_CAMADA,
  DIR_COMPONENTES,
  DIR_PREVIEW,
  casam,
  formatar,
  linhasDe,
  quantidadeDeArquivos,
} from "./varredura"

/**
 * F-07 · PROIBIÇÃO: a tela nunca emite mudança que o schema não sustenta.
 *
 * O mockup exibe um item de origem de acesso ("+12%") e a §18 repete o padrão.
 * O schema NÃO tem essa telemetria: a varredura das 99 migrations pelas colunas
 * dessa natureza só encontra a auditoria de chave de API, que é sobre
 * integração e não sobre aluno. A própria §16 já desqualifica o item.
 *
 * INVARIÂNCIA: em nenhum cenário um item de §16 ou §18 casa com o detector.
 * VARIÂNCIA: um item PLANTADO com esse texto reprova o detector — prova que ele
 *   detecta, e não é a função constante `false`.
 *
 * Os tokens são montados por concatenação DE PROPÓSITO: um detector que procura
 * o literal dentro da própria árvore acharia a si mesmo, e o teste reprovaria
 * sozinho sem que nenhum código estivesse errado.
 */

const T = ["mob", "ile"].join("")
const D = ["disposit", "ivo"].join("")
const P = ["platafor", "ma"].join("")
const U = ["user", "_agent"].join("")
const DETECTOR = new RegExp(`${T}|${D.slice(0, 9)}|app nativo|${P}`, "i")

const CENARIOS = [
  cenarioAtivosMais3(),
  cenarioRegularidadeCai(3),
  cenarioModulos([
    { id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 5 },
    { id: "m2", titulo: "Monitoramento dos Resultados", antes: 4, agora: 3 },
  ]),
]

describe("F-07 · mudança sem fonte no schema não entra", () => {
  it("INVARIÂNCIA — nenhum item de §16 ou §18 casa com o detector", () => {
    for (const entrada of CENARIOS) {
      const dados = computePadroesTendencias(entrada)
      for (const item of dados.mudancas.itens) {
        expect(DETECTOR.test(`${item.id} ${item.titulo} ${item.subtexto}`)).toBe(false)
      }
      for (const item of dados.sinais.itens) {
        expect(DETECTOR.test(`${item.id} ${item.titulo} ${item.descricao}`)).toBe(false)
      }
    }
  })

  it("VARIÂNCIA — um item plantado com esse texto é DETECTADO", () => {
    const plantado = { id: `acesso-${T}`, titulo: `Acesso via ${T} em alta`, subtexto: "" }
    expect(
      DETECTOR.test(`${plantado.id} ${plantado.titulo} ${plantado.subtexto}`),
      "o detector é cego: os testes de invariância acima são vacuosos",
    ).toBe(true)
  })

  it("INVARIÂNCIA — a camada não menciona coluna de telemetria que não existe", () => {
    const dirs = [DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW]
    // Anti-vacuidade: uma varredura que não enxerga arquivo nenhum aprova tudo.
    expect(quantidadeDeArquivos(dirs), "a varredura não achou arquivo algum").toBeGreaterThan(5)
    const padrao = new RegExp(`${T}|${D}|${U}|${P}`, "i")
    const achados = casam(linhasDe(dirs, "F-07"), padrao)
    expect(achados.length, formatar(achados)).toBe(0)
  })

  it("INVARIÂNCIA — o item plantado também seria visto pela varredura", () => {
    const padrao = new RegExp(`${T}|${D}|${U}|${P}`, "i")
    expect(padrao.test(`const item = "Acesso via ${T} em alta"`)).toBe(true)
  })

  it("INVARIÂNCIA — nenhum numeral de §16 sobrevive fora dos 4 tipos fechados", () => {
    const dados = computePadroesTendencias(CENARIOS[0] ?? cenarioAtivosMais3())
    const ids = dados.mudancas.itens.map((i) => i.id)
    for (const id of ids) {
      expect(["ativos", "regularidade", "modulos", "retomadas"]).toContain(id)
    }
    expect(serializar(ids)).not.toContain(T)
  })
})
