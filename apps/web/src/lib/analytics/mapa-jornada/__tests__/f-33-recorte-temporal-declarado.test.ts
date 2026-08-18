import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CURSO_A,
  type EntradaMapaJornada,
  acrescentarPessoa,
  apenas,
  calcular,
  diasAtras,
  entradaBase,
} from "./contrato"

/**
 * F-33 · A régua do recorte temporal.
 *
 * A constatação que precisa virar TEXTO NA TELA: a maioria dos números desta
 * tela NÃO se move com o filtro de período. Matriz, distribuição e funil são
 * posição acumulada; só o estado da pessoa depende de janela — e por
 * `SEM_ACESSO_DAYS = 14` fixo, não pelo filtro. Isso é legítimo e é
 * INDISTINGUÍVEL DE BUG enquanto não estiver escrito: foi o defeito medido na
 * Visão geral, onde "No ritmo" e "Sem acesso" ficavam sob um controle de período
 * que não os governava.
 *
 * INVARIÂNCIA: a mesma fonte com 7, 30 e 90 dias produz matriz, distribuição e
 *   funil IDÊNTICOS — a prova de que a nota diz a verdade.
 * VARIÂNCIA: o que DEVE mudar com o período muda. `retomando` (§4: "voltou a
 *   estudar dentro do período analisado") entra e sai conforme a janela. Se
 *   NADA mudasse, a nota estaria mentindo por excesso — e a invariância acima
 *   seria satisfeita por uma tela que ignora o parâmetro inteiro.
 *
 * Fonte: CONTRATO-mapa.md F-33 · SPEC-FUNCIONAL.md §3.3 e §22.
 */

const PERIODOS = [7, 30, 90] as const

/**
 * Uma pessoa que PAUSOU e VOLTOU: atividade há 60 dias, depois há 20.
 *
 * A lacuna de 40 dias é ≥ 14, e o retorno cai dentro da janela de 30 e de 90
 * dias, mas FORA da de 7. É a única entrada da fixture capaz de mover um estado
 * pelo filtro de período — sem ela, a variância deste contrato não existiria e
 * a invariância passaria por vacuidade.
 */
function comPessoaQueRetomou(): EntradaMapaJornada {
  const e = acrescentarPessoa(entradaBase(), "R1", "Rita Nogueira", CURSO_A)
  const capitulo = CAPS_A[0] as string
  return {
    ...e,
    sessoes: [
      ...(e.sessoes ?? []),
      { alunoId: "R1", capituloId: capitulo, criadaEmISO: diasAtras(60) },
      { alunoId: "R1", capituloId: capitulo, criadaEmISO: diasAtras(20) },
    ],
  }
}

/** Roster pequeno: todo mundo cabe na amostra de 8 linhas e é inspecionável. */
function recorteVisivel(): EntradaMapaJornada {
  return apenas(comPessoaQueRetomou(), ["P01", "P05", "P07", "R1"])
}

function comPeriodo(e: EntradaMapaJornada, periodoDias: number): EntradaMapaJornada {
  return { ...e, periodoDias }
}

/** Assinatura estável do que NÃO pode mudar com o período. */
function assinaturaAcumulada(r: Awaited<ReturnType<typeof calcular>>): string {
  return JSON.stringify({
    celulas: r.mapa.linhas.map((l) => `${l.alunoId}:${l.celulas.join("")}`),
    colunas: r.mapa.colunas.map((c) => `${c.numero}:${c.id}`),
    total: r.mapa.totalAlunos,
    tiles: r.distribuicao.tiles.map((t) => `${t.id}=${t.valor}/${t.pct}`),
    funil: r.funil.linhas.map(
      (l) => `${l.numero}:${l.chegaram}/${l.iniciaram}/${l.concluiram}/${l.conversaoLabel}`,
    ),
  })
}

describe("F-33 · o recorte temporal é declarado, e a declaração é verdadeira", () => {
  it("INVARIÂNCIA — matriz, distribuição e funil medem IDÊNTICO em 7, 30 e 90 dias", async () => {
    const base = recorteVisivel()
    const assinaturas: string[] = []
    for (const dias of PERIODOS) {
      assinaturas.push(assinaturaAcumulada(await calcular(comPeriodo(base, dias))))
    }

    expect(
      new Set(assinaturas).size,
      `a nota da tela AFIRMA que estes blocos não obedecem ao período; se eles mudam, a nota mente. Assinaturas: ${assinaturas.join("\n---\n")}`,
    ).toBe(1)
  })

  it("INVARIÂNCIA — a nota do período está na saída, em campo obrigatório e não vazio", async () => {
    const r = await calcular(recorteVisivel())

    expect(typeof r.notaPeriodo).toBe("string")
    expect(r.notaPeriodo.length).toBeGreaterThan(40)
    expect(r.notaPeriodo.toLowerCase()).toContain("período")
    // Campo obrigatório no tipo (lição 3): se alguém o remover, o build cai —
    // aqui a asserção só confirma que ele chega preenchido em runtime.
    expect(r.notaPeriodo.trim()).not.toBe("")
  })

  it("VARIÂNCIA — `retomando` entra e sai conforme a janela", async () => {
    const base = recorteVisivel()

    const em7 = await calcular(comPeriodo(base, 7))
    const em30 = await calcular(comPeriodo(base, 30))
    const em90 = await calcular(comPeriodo(base, 90))

    const estadoDe = (r: Awaited<ReturnType<typeof calcular>>) =>
      r.mapa.linhas.find((l) => l.alunoId === "R1")?.estado

    // Voltou há 20 dias: fora da janela de 7, dentro das de 30 e 90.
    expect(estadoDe(em7), "com 7 dias o retorno de 20 dias atrás está FORA da janela").toBe(
      "parado",
    )
    expect(estadoDe(em30)).toBe("retomando")
    expect(estadoDe(em90)).toBe("retomando")

    expect(
      new Set([estadoDe(em7), estadoDe(em30)]).size,
      "se NADA muda com o período, a nota está mentindo por excesso e a " +
        "invariância acima passa por vacuidade",
    ).toBe(2)
  })

  it("VARIÂNCIA — a pessoa que retomou continua no MESMO lugar da matriz e da distribuição", async () => {
    // O par completo da lição: o que muda é o ESTADO (janela), não a posição
    // acumulada. Se a célula ou o tile se movessem, o bloco estaria misturando
    // as duas réguas — que é exatamente o defeito que F-33 nomeia.
    const base = recorteVisivel()
    const em7 = await calcular(comPeriodo(base, 7))
    const em90 = await calcular(comPeriodo(base, 90))

    const celulasDe = (r: Awaited<ReturnType<typeof calcular>>) =>
      r.mapa.linhas.find((l) => l.alunoId === "R1")?.celulas.join("")

    expect(celulasDe(em7)).toBe(celulasDe(em90))
    expect(em7.distribuicao.tiles.map((t) => t.valor)).toEqual(
      em90.distribuicao.tiles.map((t) => t.valor),
    )
  })
})
