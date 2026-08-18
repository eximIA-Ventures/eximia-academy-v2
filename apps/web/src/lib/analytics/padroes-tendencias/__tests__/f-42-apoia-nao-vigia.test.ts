import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import {
  cenario,
  cenarioAtivosMais3,
  cenarioModulos,
  cenarioRegularidadeCai,
  serializar,
} from "./cenario"

/**
 * F-42 · I-8 — apoia, não vigia. E NENHUMA pessoa é nomeada nesta tela.
 *
 * Duas asserções, ambas com detector provado:
 *   (a) LÉXICO — nenhuma string emitida carrega vocabulário de cobrança;
 *   (b) ZERO PESSOAS — diferente da Visão geral (que lista gente na §10), os
 *       seis blocos desta tela falam de agregados, séries, padrões, MÓDULOS,
 *       faixas e contagens. A §21 é literal: "não mostrar ranking de pessoas".
 *
 * Os nomes plantados nas fixturas são DISTINTIVOS de propósito: um nome comum
 * poderia coincidir com uma palavra da tela e o teste passaria por acidente.
 */

/** Tokens por concatenação: o detector procurado no próprio arquivo se acharia. */
const PUNITIVOS = [
  ["cobr", "ar"].join(""),
  ["cobra", "nça"].join(""),
  ["penali", "zar"].join(""),
  ["adver", "tir"].join(""),
  ["puni", "r"].join(""),
  ["rank", "ing"].join(""),
  ["pio", "res alunos"].join(""),
  ["melho", "res alunos"].join(""),
]
const DETECTOR_PUNITIVO = new RegExp(PUNITIVOS.join("|"), "i")

const NOMES_PLANTADOS = ["Zorildo Quintanilha", "Wanessa Trombetta", "Ubiratã Kowalski"]

function comNomes(entrada: ReturnType<typeof cenario>) {
  return {
    ...entrada,
    alunos: entrada.alunos.map((a, i) => ({
      ...a,
      nome: NOMES_PLANTADOS[i % NOMES_PLANTADOS.length] ?? a.nome,
    })),
  }
}

const CENARIOS = [
  cenarioAtivosMais3(),
  cenarioRegularidadeCai(4),
  cenarioModulos([
    { id: "m1", titulo: "Executar Ações Corretivas", antes: 10, agora: 2 },
    { id: "m2", titulo: "Monitoramento dos Resultados", antes: 8, agora: 3 },
  ]),
  cenario({ pessoas: [] }),
]

describe("F-42 · apoia, não vigia", () => {
  it("INVARIÂNCIA — nenhuma saída carrega vocabulário de cobrança", () => {
    for (const entrada of CENARIOS) {
      const texto = serializar(computePadroesTendencias(entrada))
      expect(DETECTOR_PUNITIVO.test(texto)).toBe(false)
    }
  })

  it("VARIÂNCIA — o detector de léxico enxerga um item plantado", () => {
    expect(DETECTOR_PUNITIVO.test(`{"titulo":"${PUNITIVOS[0]} os atrasados"}`)).toBe(true)
    expect(DETECTOR_PUNITIVO.test(`{"titulo":"${PUNITIVOS[5]} da turma"}`)).toBe(true)
  })

  it("INVARIÂNCIA — nome de pessoa NENHUM vaza para a saída", () => {
    for (const entrada of CENARIOS) {
      const comNome = comNomes(entrada)
      const texto = serializar(computePadroesTendencias(comNome))
      for (const nome of NOMES_PLANTADOS) {
        expect(texto, `vazou "${nome}"`).not.toContain(nome)
        // Sobrenome sozinho também não: um vazamento parcial é vazamento.
        const sobrenome = nome.split(" ")[1] ?? nome
        expect(texto).not.toContain(sobrenome)
      }
    }
  })

  it("VARIÂNCIA — o detector de nome enxerga um vazamento plantado", () => {
    const vazado = serializar({ itens: [{ titulo: `${NOMES_PLANTADOS[0]} está parado` }] })
    expect(vazado).toContain(NOMES_PLANTADOS[0])
  })

  it("INVARIÂNCIA — a numeração de §19 numera MÓDULOS, e os títulos são de currículo", () => {
    const { gargalos } = computePadroesTendencias(
      comNomes(
        cenarioModulos([
          { id: "m1", titulo: "Executar Ações Corretivas", antes: 10, agora: 2 },
          { id: "m2", titulo: "Análise de Causa", antes: 8, agora: 4 },
        ]),
      ),
    )
    for (const item of gargalos.itens) {
      expect(NOMES_PLANTADOS).not.toContain(item.moduloTitulo)
      expect(item.posicao).toBeGreaterThan(0)
    }
  })

  it("INVARIÂNCIA — o vocabulário de estado é de apoio", () => {
    const { risco } = computePadroesTendencias(cenarioAtivosMais3())
    for (const c of risco.categorias) {
      expect(["Sustentando", "Desacelerando", "Parados", "Retomando"]).toContain(c.rotulo)
    }
  })
})
