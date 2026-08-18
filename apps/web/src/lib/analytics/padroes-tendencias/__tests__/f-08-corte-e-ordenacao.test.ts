import { describe, expect, it } from "vitest"
import { MUDANCAS_MAX, TIPOS_DE_MUDANCA, computePadroesTendencias } from "../index"
import {
  DIAS_REGULARES,
  DIA_NA_JANELA_ANTERIOR,
  PONTE_SEM_PAUSA,
  type PessoaCenario,
  capitulo,
  cenario,
} from "./cenario"

/**
 * F-08 · §16: máximo 4, ordenação por PESSOAS afetadas, reserva de slot.
 *
 * INVARIÂNCIA: com os quatro tipos presentes, saem 4 itens ordenados por
 *   pessoas afetadas. Ordena-se por gente, não por magnitude percentual: ação
 *   se toma sobre pessoas, e "módulos −25%" perde para "4 pessoas a mais".
 * VARIÂNCIA: aumentar as pessoas afetadas de um candidato o promove.
 *
 * ACHADO REGISTRADO (não é falha do código): com o conjunto de candidatos
 * FECHADO em 4 tipos (F-07 depende desse fechamento) e `MUDANCAS_MAX = 4`, o
 * CORTE é estruturalmente inalcançável — nunca há um 5º candidato para expulsar
 * o último, e a reserva de slot positivo nunca é exercida. O contrato descreve
 * um mecanismo que a régua do §16 torna inerte. Fica medido aqui em vez de
 * simulado com um candidato falso.
 */

function mundo(regulares: number): ReturnType<typeof cenario> {
  const pessoas: PessoaCenario[] = []
  for (let i = 0; i < regulares; i++) {
    pessoas.push({
      id: `r${i}`,
      sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR],
    })
  }
  for (let i = 0; i < 6; i++) pessoas.push({ id: `a${i}`, sessoes: [2] })
  // Os DOIS únicos que retomam: pausa de 35 dias com retorno na janela atual.
  for (let i = 0; i < 2; i++) pessoas.push({ id: `x${i}`, sessoes: [45, 10] })
  for (let i = 0; i < 6; i++) {
    pessoas.push({ id: `mp${i}`, porCapitulo: { m1: i < 5 ? [31, 25] : [31] } })
  }
  for (let i = 0; i < 4; i++) {
    pessoas.push({ id: `mq${i}`, porCapitulo: { m2: i < 3 ? [31, 25] : [31] } })
  }
  return cenario({
    pessoas,
    capitulos: [capitulo("m1", "Executar Ações Corretivas", 1), capitulo("m2", "Monitoramento", 2)],
  })
}

describe("F-08 · corte e ordenação do §16", () => {
  it("INVARIÂNCIA — os 4 tipos presentes saem nas 4 posições, por pessoas", () => {
    const itens = computePadroesTendencias(mundo(3)).mudancas.itens
    expect(itens.map((i) => i.id)).toEqual(["ativos", "regularidade", "modulos", "retomadas"])
    expect(itens.map((i) => i.ordem)).toEqual([1, 2, 3, 4])
    const pessoas = itens.map((i) => i.pessoas)
    expect([...pessoas].sort((a, b) => b - a)).toEqual(pessoas)
  })

  it("VARIÂNCIA — mais pessoas regulares promovem a regularidade ao topo", () => {
    const itens = computePadroesTendencias(mundo(6)).mudancas.itens
    expect(itens[0]?.id).toBe("regularidade")
  })

  it("INVARIÂNCIA — a lista nunca passa do máximo e os ids vêm do conjunto fechado", () => {
    for (const regulares of [0, 1, 3, 6]) {
      const itens = computePadroesTendencias(mundo(regulares)).mudancas.itens
      expect(itens.length).toBeLessThanOrEqual(MUDANCAS_MAX)
      for (const item of itens) expect(TIPOS_DE_MUDANCA).toContain(item.id)
    }
  })

  it("INVARIÂNCIA — quando há candidato positivo, ele está entre os exibidos", () => {
    const itens = computePadroesTendencias(mundo(3)).mudancas.itens
    expect(itens.some((i) => i.tom === "positivo")).toBe(true)
  })
})
