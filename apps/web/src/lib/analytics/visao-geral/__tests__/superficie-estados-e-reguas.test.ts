// ---------------------------------------------------------------------------
// D6 e D7 — a tela fecha a própria aritmética e publica as próprias réguas.
// ---------------------------------------------------------------------------
// DOIS DEFEITOS DE SUPERFÍCIE, medidos na tela do dono em 2026-08-17. Nenhum
// deles é erro de cálculo; os dois fazem número certo parecer número errado.
//
//   D6 — `EstadoJornada` tem SEIS estados (base.ts) e o bloco §10 desenha
//        QUATRO pílulas (atencao.ts). "Concluído" e "Retomando" contam no
//        denominador do placar e não aparecem em pílula nenhuma. Na tela real:
//        placar com base 6, segmentos somando 0+1+1+0 = 2, e as 4 pessoas que
//        sumiam eram exatamente as 4 formadas. A fileira afirmava, sem dizer,
//        uma partição que não é partição.
//
//   D7 — três rótulos escondiam a própria régua: "Sem acesso" e "Regularidade"
//        dividem por `iniciados` (§8.2/§8.5) enquanto o card ao lado publica a
//        base do recorte inteiro, e "Regularidade 0%" não trazia o critério que
//        a define.
//
// O CONTROLE POSITIVO É O PONTO DESTE ARQUIVO. Um teste que só afirma "a nota
// existe" passaria com a nota escrita à mão em qualquer lugar; um que só afirma
// "a soma fecha" passaria numa população onde ela já fechava por acidente. Por
// isso cada invariância vem com o cenário-espelho que a derruba:
//   • um cenário SEM concluídos nem retomando, onde a soma fecha e a nota TEM de
//     ser `null` (nota que aparece sempre é decoração, não explicação);
//   • um cenário COM os dois estados, onde a soma NÃO fecha e a nota tem de
//     reconciliar a diferença exata;
//   • uma métrica sem denominador próprio ("Participação"), que continua sem
//     absoluto — senão o detector de D7 estaria só descrevendo o placar inteiro.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { REGULARIDADE_MIN_DIAS_NA_SEMANA } from "../parametros"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  diasAtras,
  entradaBase,
  resolverExport,
} from "./contrato"

interface Metrica {
  id: string
  rotulo: string
  valorPrincipal: string
  valorAbsoluto: string | null
  numerador: number
  baseDenominador: number
}

interface Resultado {
  placar: { metricas: readonly Metrica[]; notaRodape?: string | null }
  atencao: {
    segmentos: readonly { id: string; rotulo: string; valor: number }[]
    notaCobertura?: string | null
  }
  roster: readonly { id: string; estado: string }[]
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

const somaDosSegmentos = (r: Resultado): number =>
  r.atencao.segmentos.reduce((total, s) => total + s.valor, 0)

const quantosNoEstado = (r: Resultado, estado: string): number =>
  r.roster.filter((a) => a.estado === estado).length

/**
 * Cenário-armadilha: dois concluídos e um retomando, ou seja gente que existe no
 * roster, entra no denominador do placar e NÃO cabe em nenhuma das 4 pílulas.
 *
 *   • P3 e P5 têm a única matrícula em `completed` ⇒ `concluidos` (o predicado
 *     de `montarBase` exige TODAS as matrículas completas);
 *   • P4 ganha atividade 30 dias atrás. Com os carimbos que já tinha (dias 3 e
 *     12), abre-se um vão de 18 dias cujo retorno cai dentro da janela ⇒
 *     `retomando`.
 */
function comConcluidosERetomando(): EntradaVisaoGeral {
  const base = entradaBase()
  return {
    ...base,
    matriculas: base.matriculas.map((m) =>
      m.studentId === "P3" || m.studentId === "P5" ? { ...m, status: "completed" as const } : m,
    ),
    atividades: [
      ...base.atividades,
      { studentId: "P4", createdAt: diasAtras(30), tipo: "sessao" as const, questionId: "Q1" },
    ],
  }
}

describe("D6 · os 4 segmentos não escondem os 2 estados sem card", () => {
  it("CONTROLE — o cenário-armadilha realmente produz concluídos e retomando fora dos segmentos", async () => {
    const r = await calcular(comConcluidosERetomando())

    // Sem estas três afirmações, a invariância seguinte poderia passar num
    // cenário onde não há nada a explicar.
    expect(quantosNoEstado(r, "concluido"), "o cenário precisa ter concluídos").toBeGreaterThan(0)
    expect(quantosNoEstado(r, "retomando"), "o cenário precisa ter retomando").toBeGreaterThan(0)
    expect(
      somaDosSegmentos(r),
      "a soma dos 4 segmentos precisa ficar ABAIXO da base, senão não há defeito a corrigir",
    ).toBeLessThan(r.roster.length)
  })

  it("INVARIÂNCIA — a nota reconcilia a soma dos segmentos com a base do placar", async () => {
    const r = await calcular(comConcluidosERetomando())
    const fora = r.roster.length - somaDosSegmentos(r)
    const nota = r.atencao.notaCobertura ?? ""

    expect(nota, "a soma não fecha e a tela não explica por quê").not.toBe("")
    // Os três numerais que o gestor consegue conferir na própria tela.
    expect(nota, nota).toContain(`${somaDosSegmentos(r)} de ${r.roster.length}`)
    expect(nota, nota).toContain(`${quantosNoEstado(r, "concluido")} concluíram`)
    expect(nota, nota).toContain(`${quantosNoEstado(r, "retomando")} retomou`)
    // A aritmética da própria frase fecha: quem está fora é exatamente a soma
    // dos dois estados sem card.
    expect(quantosNoEstado(r, "concluido") + quantosNoEstado(r, "retomando"), nota).toBe(fora)
  })

  it("CONTROLE NEGATIVO — quando a soma fecha, não há nota", async () => {
    const r = await calcular(entradaBase())

    expect(
      quantosNoEstado(r, "concluido") + quantosNoEstado(r, "retomando"),
      "a população base não pode ter estado sem card, senão este controle não discrimina",
    ).toBe(0)
    expect(somaDosSegmentos(r)).toBe(r.roster.length)
    expect(
      r.atencao.notaCobertura ?? null,
      "nota que aparece mesmo com a soma fechada é decoração, não explicação",
    ).toBeNull()
  })
})

describe("D7 · os rótulos publicam a própria base e a própria régua", () => {
  it("INVARIÂNCIA — Regularidade e Sem acesso mostram o denominador que usam", async () => {
    const r = await calcular(entradaBase())
    const placar = r.placar.metricas

    for (const id of ["regularidade", "sem-acesso"]) {
      const m = placar.find((x) => x.id === id)
      expect(m, `métrica "${id}" sumiu do placar`).toBeDefined()
      if (!m) continue
      expect(m.valorAbsoluto, `"${m.rotulo}" não publica o absoluto`).toBe(
        `${m.numerador} de ${m.baseDenominador}`,
      )
      expect(m.valorPrincipal, `"${m.rotulo}" perdeu o percentual`).toContain(
        `${m.numerador} de ${m.baseDenominador} · `,
      )
    }
  })

  it("CONTROLE — o denominador publicado é MESMO diferente do da base do recorte", async () => {
    const r = await calcular(entradaBase())
    const semAcesso = r.placar.metricas.find((m) => m.id === "sem-acesso")
    const ativos = r.placar.metricas.find((m) => m.id === "ativos")

    // Se as duas bases coincidissem, o defeito medido ("o gestor divide por 6 e
    // vê 20%") não existiria neste cenário e a asserção acima seria vácua.
    expect(semAcesso?.baseDenominador, "§8.5 exclui quem nunca iniciou").toBeLessThan(
      ativos?.baseDenominador ?? 0,
    )
  })

  it("CONTROLE — métrica sem base própria continua SEM absoluto", async () => {
    const r = await calcular(entradaBase())
    const participacao = r.placar.metricas.find((m) => m.id === "participacao")

    // Sem este controle, o detector acima passaria numa implementação que
    // simplesmente ligou o absoluto nos cinco tiles.
    expect(participacao?.valorAbsoluto ?? null, "Participação usa a base do recorte").toBeNull()
  })

  it("INVARIÂNCIA — a régua de Regularidade e o recorte temporal ficam RENDERIZADOS", async () => {
    const r = await calcular(entradaBase())
    const nota = r.placar.notaRodape ?? ""

    expect(nota, "o placar não publica régua nenhuma").not.toBe("")
    // O número vem do parâmetro: régua digitada à mão dessincroniza do cálculo.
    expect(nota, nota).toContain(`${REGULARIDADE_MIN_DIAS_NA_SEMANA} dias distintos`)
    expect(nota, nota).toContain("No ritmo e Sem acesso")
    expect(nota, nota).toMatch(/hoje/)
  })
})
