import { describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  detectarChavesRanking,
  detectarListaComRankingNumerado,
  detectarVocabularioPunitivo,
  diasAtras,
  entradaBase,
  percorrer,
  resolverExport,
} from "./contrato"

/**
 * I-8 · A tela apoia, não vigia.
 *
 * INVARIÂNCIA (testes 2, 3 e 4): nenhuma lista da Visão geral é ordenada por
 *   mérito decrescente com posição numerada; nenhuma chave é de ranking;
 *   nenhum rótulo usa vocabulário de cobrança (§2 Regra 2, §10.2).
 * VARIÂNCIA: não se aplica ao valor — a ausência tem que valer sempre. Em
 *   lugar dela, três guardas contra o verde por vacuidade:
 *   • teste 1: a saída TEM listas com itens, senão a varredura é sobre o vazio;
 *   • teste 5: `prioridade 1|2|3` de AÇÃO continua PERMITIDA (C-39), o que
 *     prova que o detector não é um "proibido qualquer número";
 *   • teste 6: o detector acusa um ranking PLANTADO e absolve uma fila de
 *     triagem ordenada sem numeração.
 *
 * Fonte: INVARIANTES.md I-8 · SPEC-FUNCIONAL.md §2 Regra 2 e §10.2 · fixture.ts
 * D-19/D-20/C-39.
 */

interface Resultado {
  atencao: { linhas: ReadonlyArray<Record<string, unknown>>; segmentos: ReadonlyArray<unknown> }
  recomendacoes: { recomendacoes: ReadonlyArray<{ prioridade: number }> }
  sinais: { itens: ReadonlyArray<unknown> }
  [k: string]: unknown
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

function entradaCheia(): EntradaVisaoGeral {
  const base = entradaBase()
  return {
    ...base,
    acionamentos: [
      { recipientId: "P3", sentAt: diasAtras(9), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(4), sentByManager: "G1" },
    ],
  }
}

describe("I-8 · a tela apoia, não vigia", () => {
  it("ANTI-VACUIDADE — a saída tem listas com itens para varrer", async () => {
    const r = await calcular(entradaCheia())
    let listasComItens = 0
    percorrer(r, ({ valor }) => {
      if (Array.isArray(valor) && valor.length > 0) listasComItens += 1
    })

    expect(
      listasComItens,
      "nenhuma lista povoada na saída: 'não há ranking' seria verdade por ausência de listas",
    ).toBeGreaterThanOrEqual(3)
  })

  it("INVARIÂNCIA — nenhuma chave de posição em ranking em lugar nenhum", async () => {
    const r = await calcular(entradaCheia())
    const violacoes = detectarChavesRanking(r)

    expect(violacoes.map((v) => `${v.caminho}: ${v.detalhe}`)).toEqual([])
  })

  it("INVARIÂNCIA — nenhuma lista numerada 1..N ordenada por mérito decrescente", async () => {
    const r = await calcular(entradaCheia())
    const violacoes = detectarListaComRankingNumerado(r)

    expect(
      violacoes.map((v) => `${v.caminho}: ${v.detalhe}`),
      "uma reescrita otimizando contra o PNG cria ranking sem perceber",
    ).toEqual([])
  })

  it("INVARIÂNCIA — nenhum rótulo usa vocabulário de cobrança", async () => {
    const r = await calcular(entradaCheia())
    const violacoes = detectarVocabularioPunitivo(r)

    expect(violacoes.map((v) => `${v.caminho}: ${v.detalhe}`)).toEqual([])
  })

  it("PERMITIDO — prioridade de AÇÃO 1|2|3 continua existindo e não é ranking", async () => {
    const r = await calcular(entradaCheia())
    const prioridades = r.recomendacoes.recomendacoes.map((x) => x.prioridade)

    // C-39: prioridade é de AÇÃO, não posição de pessoa. Um detector que
    // proibisse todo número sequencial reprovaria aqui — e estaria errado.
    expect(prioridades.length).toBeGreaterThan(0)
    expect(prioridades.every((p) => p >= 1 && p <= 3)).toBe(true)
    expect(detectarChavesRanking(r.recomendacoes)).toEqual([])
    expect(detectarListaComRankingNumerado(r.recomendacoes)).toEqual([])
  })

  it("DETECTOR — acusa ranking plantado e absolve fila de triagem sem numeração", () => {
    const ranking = {
      lista: [
        { posicao: 1, nome: "Adriana", pontuacao: 92 },
        { posicao: 2, nome: "Bruno", pontuacao: 81 },
        { posicao: 3, nome: "Camila", pontuacao: 70 },
      ],
    }
    const fila = {
      linhas: [
        { nome: "Fernanda", sinalRotulo: "Parado", diasSemAtividade: 47 },
        { nome: "Eduardo", sinalRotulo: "Parado", diasSemAtividade: 42 },
        { nome: "Denise", sinalRotulo: "Perdendo ritmo", diasSemAtividade: 35 },
      ],
    }
    const punitivo = { recomendacoes: [{ titulo: "Cobrar 6 pessoas paradas" }] }

    expect(detectarListaComRankingNumerado(ranking)).toHaveLength(1)
    expect(detectarChavesRanking(ranking).length).toBeGreaterThan(0)

    // Fila de triagem ordenada por severidade, SEM numeração e SEM chave de
    // mérito, é o comportamento correto — não pode ser acusada.
    expect(detectarListaComRankingNumerado(fila)).toEqual([])
    expect(detectarChavesRanking(fila)).toEqual([])

    expect(detectarVocabularioPunitivo(punitivo)).toHaveLength(1)
    expect(detectarVocabularioPunitivo(fila)).toEqual([])
  })
})
