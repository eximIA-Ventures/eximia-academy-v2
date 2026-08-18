import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenarioAtivosMais3, cenarioRegularidadeCai } from "./cenario"

/**
 * F-15 · Seletor de periodicidade: uma opção, e a UI diz isso.
 *
 * O MVP tem UMA periodicidade. Um menu que abre e não oferece nada é defeito de
 * contrato, não de estilo: promete escolha inexistente.
 *
 * INVARIÂNCIA: `opcoes.length === 1` e `periodicidade === "semanal"`.
 * VARIÂNCIA: a asserção lê a ESTRUTURA — um segundo item na lista mudaria o
 *   tamanho, e o teste que conta o tamanho reprovaria (provado abaixo sobre uma
 *   lista mutada, para o `toBe(1)` não ser tautologia).
 */

describe("F-15 · periodicidade", () => {
  it("INVARIÂNCIA — uma opção só, em todo cenário", () => {
    for (const entrada of [cenarioAtivosMais3(), cenarioRegularidadeCai(3)]) {
      const { serie } = computePadroesTendencias(entrada)
      expect(serie.periodicidade).toBe("semanal")
      expect(serie.opcoes).toEqual(["semanal"])
    }
  })

  it("INVARIÂNCIA — a periodicidade sobrevive ao estado vazio", () => {
    // O rótulo descreve a RÉGUA do gráfico, não o dado: some junto com a série
    // seria perder a referência de leitura justamente quando ela é pedida.
    const { serie } = computePadroesTendencias(cenario2SemanasVazias())
    expect(serie.estado).toBe("vazio")
    expect(serie.periodicidade).toBe("semanal")
  })

  it("VARIÂNCIA — a asserção mede a lista, não uma constante do teste", () => {
    const { serie } = computePadroesTendencias(cenarioAtivosMais3())
    const mutada = [...serie.opcoes, "diario"]
    expect(mutada.length).not.toBe(serie.opcoes.length)
  })
})

/** Uma pessoa com atividade numa semana só: menos que o mínimo da §32. */
function cenario2SemanasVazias() {
  return {
    agoraISO: "2026-08-17T12:00:00.000Z",
    periodoDias: 30,
    gestorId: "gestor-1",
    escopo: ["a"],
    alunos: [{ id: "a", nome: "Pessoa a" }],
    atividades: [
      { studentId: "a", createdAt: "2026-08-16T10:00:00.000Z", tipo: "sessao" as const },
    ],
    acionamentos: [],
    matriculas: [
      {
        studentId: "a",
        courseId: "c1",
        status: "active" as const,
        createdAt: "2026-04-19T10:00:00.000Z",
        progressPercent: 10,
      },
    ],
    cursos: [{ id: "c1", deadlineDays: null }],
    capitulos: [],
    tenantId: "t1",
  }
}
