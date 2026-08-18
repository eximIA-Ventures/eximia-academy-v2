import { describe, expect, it } from "vitest"
import { ehCobranca, triarDestinatarios } from "../acionamento-alvo"
import type { EstadoJornada } from "../tipos"

/**
 * O ENVIO não alcança quem concluiu.
 *
 * DEFEITO DE ORIGEM (dono do produto, 2026-08-17, tenant Cory Alimentos em
 * PRODUÇÃO): a tela exibiu "Apoiar 4 pessoas paradas" e as 4 eram exatamente as
 * 4 com matrícula concluída. Elas "pararam" porque terminaram.
 *
 * `recomendacoes-concluido-nao-e-cobranca.test.ts` já tranca a LISTA. Este
 * arquivo tranca o ENVIO, que é o momento irreversível: `dispatchTeamNudge`
 * grava em `notifications` de cliente pagante e não tem desfazer. Enquanto o
 * filtro vivia só na montagem da lista, qualquer caminho novo de reunir
 * destinatários (a gaveta, um grupo, um bloco futuro) nascia fora da proteção.
 *
 * CONTROLE POSITIVO — cada cenário afirma, ANTES da invariância, que (a) havia
 * concluído na entrada e (b) sobrou gente para acionar. Sem isso, apagar a
 * função e devolver lista vazia ficaria verde.
 *
 * VARIÂNCIA — o par-espelho: duas entradas idênticas exceto pelo estado
 * `"concluido"`, e é a diferença entre elas que discrimina. Um filtro que
 * barrasse todo mundo (ou ninguém) reprova aqui.
 */

const ESTADOS: Record<string, EstadoJornada> = {
  ana: "parado",
  bruno: "concluido",
  carla: "perdendo-ritmo",
  davi: "concluido",
  elis: "sustentando",
}

const TODOS = ["ana", "bruno", "carla", "davi", "elis"]

describe("acionamento não alcança quem concluiu", () => {
  it("CONTROLE POSITIVO — o cenário tem concluídos E não-concluídos", () => {
    expect(TODOS.filter((id) => ESTADOS[id] === "concluido")).toHaveLength(2)
    expect(TODOS.filter((id) => ESTADOS[id] !== "concluido")).toHaveLength(3)
  })

  it("INVARIÂNCIA — reativação não alcança quem concluiu, e alcança o resto", () => {
    const t = triarDestinatarios(TODOS, "inactive", ESTADOS)
    expect(t.permitidos).toEqual(["ana", "carla", "elis"])
    expect(t.bloqueadosPorConclusao).toEqual(["bruno", "davi"])
    // Sobrou gente: a regra continua disparando depois da correção, com a lista
    // menor. Apagar a regra para ficar verde reprova aqui.
    expect(t.permitidos.length).toBeGreaterThan(0)
  })

  it("INVARIÂNCIA — vale para TODOS os tipos de cobrança, não só `inactive`", () => {
    for (const tipo of [
      "inactive",
      "never_accessed",
      "no_reflection",
      "behind_teaching_plan",
      "custom",
    ] as const) {
      expect(ehCobranca(tipo), tipo).toBe(true)
      const t = triarDestinatarios(TODOS, tipo, ESTADOS)
      expect(t.permitidos, tipo).not.toContain("bruno")
      expect(t.permitidos, tipo).not.toContain("davi")
    }
  })

  it("VARIÂNCIA — o par-espelho: só o estado muda, e só ele decide", () => {
    const comConcluido = triarDestinatarios(["x"], "inactive", { x: "concluido" })
    const semConcluido = triarDestinatarios(["x"], "inactive", { x: "parado" })
    expect(comConcluido.permitidos).toEqual([])
    expect(semConcluido.permitidos).toEqual(["x"])
  })

  it("RECONHECIMENTO alcança quem concluiu — não é cobrança", () => {
    // A §29 regra D manda reconhecer quem sustentou; quem concluiu sustentou até
    // o fim. Barrá-lo aqui seria o erro simétrico: a tela deixaria de poder
    // parabenizar exatamente quem mais merece.
    expect(ehCobranca("top_performer")).toBe(false)
    const t = triarDestinatarios(TODOS, "top_performer", ESTADOS)
    expect(t.permitidos).toEqual(TODOS)
    expect(t.bloqueadosPorConclusao).toEqual([])
  })

  it("FAIL-CLOSED — estado desconhecido é barrado, não liberado", () => {
    // Não saber o estado de alguém não autoriza cobrá-lo. É o caso do preview
    // (mapa vazio) e o de um id que caiu fora do roster entre o render e o
    // clique.
    const t = triarDestinatarios(["fantasma", "ana"], "inactive", ESTADOS)
    expect(t.permitidos).toEqual(["ana"])
    expect(t.bloqueadosPorEstadoDesconhecido).toEqual(["fantasma"])

    const vazio = triarDestinatarios(TODOS, "inactive", {})
    expect(vazio.permitidos).toEqual([])
    expect(vazio.bloqueadosPorEstadoDesconhecido).toEqual(TODOS)
  })

  it("INVARIÂNCIA — a ordem de chegada é preservada: fila, não pódio (I-8)", () => {
    const invertido = [...TODOS].reverse()
    expect(triarDestinatarios(invertido, "inactive", ESTADOS).permitidos).toEqual([
      "elis",
      "carla",
      "ana",
    ])
  })

  it("INVARIÂNCIA — `Map` e objeto produzem o MESMO veredito", () => {
    // A prop atravessa a fronteira RSC como objeto; a camada de dados prefere
    // `Map`. Dois caminhos de leitura com resultados diferentes seria o defeito.
    const comMapa = triarDestinatarios(TODOS, "inactive", new Map(Object.entries(ESTADOS)))
    const comObjeto = triarDestinatarios(TODOS, "inactive", ESTADOS)
    expect(comMapa).toEqual(comObjeto)
  })
})
