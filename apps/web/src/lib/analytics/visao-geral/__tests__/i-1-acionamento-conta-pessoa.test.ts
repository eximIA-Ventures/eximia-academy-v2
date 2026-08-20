import { describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  diasAtras,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * I-1 · Acionamento conta PESSOA, não notificação.
 *
 * INVARIÂNCIA (teste 1 e 2): N notificações para o MESMO destinatário contam
 *   1 em "pessoas acionadas". A saída não pode variar com N.
 * VARIÂNCIA   (teste 3, 4 e 5): a saída TEM que variar com o número de
 *   destinatários DISTINTOS e com o retorno observado. Sem estes, a função
 *   `() => 1` passaria no teste de invariância — que é exatamente a armadilha
 *   que este arquivo existe para fechar.
 * ANTI-CONSTANTE (teste 2): `notificacoesEnviadas` tem que continuar contando
 *   NOTIFICAÇÕES (3) enquanto `pessoasAcionadas` conta PESSOAS (1). Uma função
 *   que devolve 1 nos dois campos reprova aqui.
 *
 * Fonte: INVARIANTES.md I-1 · SPEC-FUNCIONAL.md §12 · fixture.ts §11.
 */

interface Resposta {
  estado?: string
  pessoasAcionadas: number
  notificacoesEnviadas: number
  retomaramEmAte7Dias: number
  estatisticas?: ReadonlyArray<{ id: string; valor: string; rotulo: string }>
}

interface Resultado {
  resposta: Resposta
}

async function calcular(entrada: EntradaVisaoGeral): Promise<Resultado> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Resultado>(fn, entrada)
}

const comAcionamentos = (
  entrada: EntradaVisaoGeral,
  acionamentos: EntradaVisaoGeral["acionamentos"],
): EntradaVisaoGeral => ({ ...entrada, acionamentos })

describe("I-1 · acionamento conta pessoa, não notificação", () => {
  it("INVARIÂNCIA — 3 notificações para o mesmo destinatário contam 1 pessoa acionada", async () => {
    const entrada = comAcionamentos(entradaBase(), [
      { recipientId: "P5", sentAt: diasAtras(10), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(6), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(2), sentByManager: "G1" },
    ])

    const { resposta } = await calcular(entrada)

    expect(resposta.pessoasAcionadas).toBe(1)
  })

  it("ANTI-CONSTANTE — a contagem de notificações continua sendo 3 no mesmo cenário", async () => {
    const entrada = comAcionamentos(entradaBase(), [
      { recipientId: "P5", sentAt: diasAtras(10), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(6), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(2), sentByManager: "G1" },
    ])

    const { resposta } = await calcular(entrada)

    // Se pessoasAcionadas e notificacoesEnviadas forem iguais, ou o dedupe não
    // existe (3/3) ou a função devolve constante (1/1). Os dois reprovam.
    expect(resposta.notificacoesEnviadas).toBe(3)
    expect(resposta.pessoasAcionadas).toBe(1)
    expect(resposta.pessoasAcionadas).not.toBe(resposta.notificacoesEnviadas)
  })

  it("VARIÂNCIA — 3 destinatários distintos contam 3 pessoas acionadas", async () => {
    const entrada = comAcionamentos(entradaBase(), [
      { recipientId: "P3", sentAt: diasAtras(10), sentByManager: "G1" },
      { recipientId: "P4", sentAt: diasAtras(6), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(2), sentByManager: "G1" },
    ])

    const { resposta } = await calcular(entrada)

    expect(resposta.pessoasAcionadas).toBe(3)
    expect(resposta.notificacoesEnviadas).toBe(3)
  })

  it("VARIÂNCIA — mistura de 5 notificações para 3 pessoas conta 3, não 5 nem 1", async () => {
    const entrada = comAcionamentos(entradaBase(), [
      { recipientId: "P3", sentAt: diasAtras(12), sentByManager: "G1" },
      { recipientId: "P3", sentAt: diasAtras(11), sentByManager: "G1" },
      { recipientId: "P4", sentAt: diasAtras(9), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(4), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(3), sentByManager: "G1" },
    ])

    const { resposta } = await calcular(entrada)

    expect(resposta.pessoasAcionadas).toBe(3)
    expect(resposta.notificacoesEnviadas).toBe(5)
  })

  it("VARIÂNCIA — a pessoa acionada 3x que voltou conta 1 retorno, e a taxa não é 33%", async () => {
    // P5 estava parado há 20 dias; um acionamento há 10 dias e atividade há 8
    // dias fecha a janela de 7 dias do último acionamento anterior a ela.
    const base = entradaBase()
    const entrada: EntradaVisaoGeral = {
      ...base,
      acionamentos: [
        { recipientId: "P5", sentAt: diasAtras(12), sentByManager: "G1" },
        { recipientId: "P5", sentAt: diasAtras(11), sentByManager: "G1" },
        { recipientId: "P5", sentAt: diasAtras(10), sentByManager: "G1" },
        { recipientId: "P3", sentAt: diasAtras(10), sentByManager: "G1" },
      ],
      atividades: [
        ...base.atividades,
        { studentId: "P5", createdAt: diasAtras(8), tipo: "sessao", questionId: "Q1" },
      ],
    }

    const { resposta } = await calcular(entrada)

    // 2 pessoas acionadas (P5, P3), 1 voltou. Sem dedupe seriam 4 acionadas e a
    // taxa despencaria para 25% — o defeito descrito em I-1.
    expect(resposta.pessoasAcionadas).toBe(2)
    expect(resposta.retomaramEmAte7Dias).toBe(1)
  })
})
