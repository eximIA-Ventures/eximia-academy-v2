import { describe, expect, it } from "vitest"
import {
  type AtividadeBruta,
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  clonarPopulacao,
  diasAtras,
  entradaBase,
  espelharNoPeriodoAnterior,
  resolverExport,
} from "./contrato"

/**
 * I-5 · Comparação de período compara o mesmo universo.
 *
 * INVARIÂNCIA (testes 1, 2 e 3): mudar o ESCOPO sem mudar o comportamento não
 *   move o delta; espelhar o comportamento atual na janela anterior zera todo
 *   delta; e isso vale para mais de uma duração de período (paridade de
 *   duração, correção FORM-07).
 * VARIÂNCIA (testes 4 e 5): mudar o COMPORTAMENTO da janela anterior move o
 *   delta. Sem isto, `deltaPp = 0` sempre passaria nos três primeiros — a
 *   armadilha desta tarefa na sua forma mais literal.
 * ANTI-CONSTANTE (teste 6): a fixture base produz pelo menos um delta ≠ 0,
 *   senão o teste 2 ("espelhar zera") estaria confirmando um zero que já
 *   existia.
 *
 * Fonte: INVARIANTES.md I-5 · aggregate/route.ts:1056-1092 (FORM-07).
 */

interface Metrica {
  id: string
  valorPrincipal: string
  numerador: number
  baseDenominador: number
  deltaPp: number | null
  deltaDirecao: "up" | "down" | null
}

interface Resultado {
  placar: { metricas: readonly Metrica[] }
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

/** Delta COM SINAL. A fixture guarda magnitude em `deltaPp` e sinal em `deltaDirecao`. */
function deltasDe(r: Resultado): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const m of r.placar.metricas) {
    out[m.id] =
      m.deltaPp === null || m.deltaPp === undefined
        ? null
        : m.deltaDirecao === "down"
          ? -m.deltaPp
          : m.deltaPp
  }
  return out
}

function taxasDe(r: Resultado): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of r.placar.metricas) out[m.id] = m.valorPrincipal
  return out
}

/** Injeta atividade SÓ na janela anterior: o passado muda, o presente não. */
function adensarPeriodoAnterior(e: EntradaVisaoGeral): EntradaVisaoGeral {
  const extras: AtividadeBruta[] = []
  for (const aluno of e.alunos) {
    for (const d of [33, 36, 40, 43, 47, 50]) {
      extras.push({
        studentId: aluno.id,
        createdAt: diasAtras(d),
        tipo: "sessao",
        questionId: "Q1",
      })
    }
  }
  return { ...e, atividades: [...e.atividades, ...extras] }
}

describe("I-5 · comparação de período compara o mesmo universo", () => {
  it("INVARIÂNCIA — duplicar a população não move nenhum delta nem nenhuma taxa", async () => {
    const base = entradaBase()
    const a = await calcular(base)
    const b = await calcular(clonarPopulacao(base))

    // Cada pessoa ganhou um gêmeo com carimbos idênticos: o comportamento
    // agregado é o mesmo, só o tamanho do recorte mudou.
    expect(deltasDe(b)).toEqual(deltasDe(a))
    expect(taxasDe(b)).toEqual(taxasDe(a))
  })

  it("INVARIÂNCIA — espelhar o comportamento na janela anterior zera todo delta", async () => {
    const espelhado = espelharNoPeriodoAnterior(entradaBase())
    const deltas = deltasDe(await calcular(espelhado))

    for (const [id, delta] of Object.entries(deltas)) {
      if (delta === null) continue // métrica sem histórico reconstruível (ex.: "No ritmo")
      expect(delta, `métrica "${id}" com comportamento idêntico nas duas janelas`).toBe(0)
    }
  })

  it("INVARIÂNCIA — a paridade de duração vale para períodos diferentes", async () => {
    for (const periodoDias of [7, 30]) {
      const base = { ...entradaBase(), periodoDias }
      const deltas = deltasDe(await calcular(espelharNoPeriodoAnterior(base)))
      for (const [id, delta] of Object.entries(deltas)) {
        if (delta === null) continue
        expect(delta, `período ${periodoDias}d, métrica "${id}"`).toBe(0)
      }
    }
  })

  it("VARIÂNCIA — adensar SÓ a janela anterior move pelo menos um delta", async () => {
    const base = entradaBase()
    const antes = deltasDe(await calcular(base))
    const depois = deltasDe(await calcular(adensarPeriodoAnterior(base)))

    const mudou = Object.keys(antes).some((id) => antes[id] !== depois[id])
    expect(
      mudou,
      `nenhum delta se moveu ao mudar o comportamento passado: ${JSON.stringify(antes)} → ` +
        `${JSON.stringify(depois)}. Delta constante passa em qualquer teste de invariância.`,
    ).toBe(true)
  })

  it("VARIÂNCIA — as taxas do período atual NÃO se movem quando só o passado muda", async () => {
    const base = entradaBase()
    const antes = taxasDe(await calcular(base))
    const depois = taxasDe(await calcular(adensarPeriodoAnterior(base)))

    // Contrapartida do teste anterior: o delta muda, o valor exibido não.
    // Se o valor atual se mexer, a janela atual está capturando o passado.
    expect(depois).toEqual(antes)
  })

  it("ANTI-CONSTANTE — a fixture base produz pelo menos um delta diferente de zero", async () => {
    const deltas = deltasDe(await calcular(entradaBase()))
    const naoZero = Object.entries(deltas).filter(([, v]) => v !== null && v !== 0)

    expect(
      naoZero.length,
      `todos os deltas da fixture base são 0 ou null (${JSON.stringify(deltas)}): o teste de espelhamento estaria confirmando um zero que já existia`,
    ).toBeGreaterThan(0)
  })
})
