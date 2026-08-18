import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import type { IdFaixa } from "../index"
import { DIAS_REGULARES, PONTE_SEM_PAUSA, cenario } from "./cenario"

/**
 * F-26 · F-27 · F-28 · F-29 — as quatro faixas da §20, uma cascata exclusiva.
 *
 * Os quatro contratos moram no mesmo arquivo DE PROPÓSITO: a propriedade que
 * cada um precisa provar é "entra AQUI e em nenhuma outra", e isso só é
 * verificável olhando as quatro juntas. Testados em arquivos separados, cada um
 * poderia passar com a mesma pessoa contada duas vezes.
 *
 * VARIÂNCIA de cada um: mover uma pessoa entre faixas mudando só o padrão de
 * dias dela.
 */

/**
 * Uma pessoa REGULAR fixa, presente em toda medição.
 *
 * Ela existe por um motivo mecânico: um recorte cujo ÚNICO integrante não tem
 * carimbo cai no estado vazio, e a partição some inteira. Sem a âncora, o teste
 * de "Sem atividade" mediria o estado vazio do bloco, não a faixa.
 */
const ANCORA = { id: "ancora", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] }

/**
 * Em qual faixa a pessoa `alvo` caiu, medida por DIFERENÇA.
 *
 * Compara a partição do recorte com o alvo contra a do recorte sem ele: a faixa
 * que ganhou uma pessoa é a dele. Medir por diferença, e não isolando o alvo
 * num recorte de uma pessoa, mantém a janela e o denominador idênticos nas duas
 * medições — que é I-5 aplicado ao próprio instrumento.
 */
function faixaDe(alvo: Parameters<typeof cenario>[0]["pessoas"][number]): IdFaixa | null {
  const com = computePadroesTendencias(cenario({ pessoas: [ANCORA, alvo] })).participacao
  const sem = computePadroesTendencias(cenario({ pessoas: [ANCORA] })).participacao
  // Anti-vacuidade: se a partição não fecha, a diferença abaixo não significa nada.
  expect(com.faixas.reduce((s, f) => s + f.pessoas, 0)).toBe(2)
  expect(sem.faixas.reduce((s, f) => s + f.pessoas, 0)).toBe(1)

  const ganhou = com.faixas.filter((f) => {
    const antes = sem.faixas.find((g) => g.id === f.id)?.pessoas ?? 0
    return f.pessoas - antes === 1
  })
  expect(ganhou).toHaveLength(1)
  return ganhou[0]?.id ?? null
}

/** 1 dia em cada uma de 4 semanas: constante, mas nunca 2x na mesma semana. */
const UM_DIA_POR_SEMANA = [1, 8, 15, 22]
/** Atividade numa semana só, dentro de uma janela de 4: sem padrão. */
const UMA_SEMANA_SO = [1]

describe("F-26 a F-29 · as quatro faixas da participação", () => {
  it("F-26 INVARIÂNCIA — 2 dias por semana entra em '2x ou mais/semana'", () => {
    expect(faixaDe({ id: "alvo", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] })).toBe(
      "2x-ou-mais",
    )
  })

  it("F-27 VARIÂNCIA — reduzir para 1 dia por semana move para '1x/semana'", () => {
    expect(faixaDe({ id: "alvo", sessoes: UM_DIA_POR_SEMANA })).toBe("1x")
  })

  it("F-28 VARIÂNCIA — atividade numa semana só move para 'Irregular'", () => {
    expect(faixaDe({ id: "alvo", sessoes: UMA_SEMANA_SO })).toBe("irregular")
  })

  it("F-29 VARIÂNCIA — nenhum carimbo na janela cai em 'Sem atividade'", () => {
    expect(faixaDe({ id: "alvo", sessoes: [] })).toBe("sem-atividade")
  })

  it("F-29 INVARIÂNCIA — quem NUNCA iniciou não some: aparece em 'Sem atividade'", () => {
    // É assim que a lição 4 fica estrutural — não medido nunca sai do
    // denominador, entra na faixa que diz exatamente isso.
    const { participacao, contexto } = computePadroesTendencias(
      cenario({
        pessoas: [
          { id: "ativa", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] },
          { id: "fantasma", semMatricula: true },
        ],
      }),
    )
    const sem = participacao.faixas.find((f) => f.id === "sem-atividade")
    expect(sem?.pessoas).toBe(1)
    expect(contexto.totalRecorte).toBe(2)
  })

  it("INVARIÂNCIA — cada pessoa entra em UMA faixa, nunca em duas", () => {
    const pessoas = [
      { id: "regular", sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA] },
      { id: "semanal", sessoes: UM_DIA_POR_SEMANA },
      { id: "esporadica", sessoes: UMA_SEMANA_SO },
      { id: "ausente", sessoes: [] },
    ]
    const { participacao } = computePadroesTendencias(cenario({ pessoas }))
    expect(participacao.faixas.reduce((s, f) => s + f.pessoas, 0)).toBe(4)
    expect(participacao.faixas.map((f) => f.pessoas)).toEqual([1, 1, 1, 1])
  })

  it("INVARIÂNCIA — os rótulos são os literais do PNG, nesta ordem", () => {
    const { participacao } = computePadroesTendencias(
      cenario({ pessoas: [{ id: "a", sessoes: UM_DIA_POR_SEMANA }] }),
    )
    expect(participacao.faixas.map((f) => f.rotulo)).toEqual([
      "2x ou mais/semana",
      "1x/semana",
      "Irregular",
      "Sem atividade",
    ])
  })
})
