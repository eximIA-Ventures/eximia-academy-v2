import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario } from "./cenario"
import { DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW, casam, formatar, linhasDe } from "./varredura"

/**
 * F-41 · I-6 — chave de dia UTC, estável entre máquinas e fusos.
 *
 * Toda API de data que lê o fuso do PROCESSO está proibida no caminho desta
 * tela: com ela, a mesma métrica oscila entre servidor e cliente sem ninguém
 * tocar no banco.
 *
 * INVARIÂNCIA: o fuso do processo não muda a saída.
 * VARIÂNCIA REAL: mover um carimbo de 23:59Z para 00:01Z do dia seguinte MUDA a
 *   semana — sem isto, uma função constante no eixo do tempo passaria na
 *   invariância de fuso.
 */

/** Tokens montados por concatenação: o detector não pode achar a si mesmo. */
const PROIBIDOS = [
  ["toLocale", "DateString"].join(""),
  ["getMon", "th("].join(""),
  ["getFullY", "ear("].join(""),
  ["getDa", "te("].join(""),
  ["startOf", "Day"].join(""),
  ["startOfI", "SOWeek"].join(""),
]

/**
 * Linhas de PRODUÇÃO, sem `__tests__`.
 *
 * COLISÃO REPORTADA: o teste de variância abaixo é obrigado a citar o nome da
 * API proibida para provar que o detector a enxerga, e um teste vizinho a cita
 * na própria explicação. Varrer os testes junto faria a prova acusar a si
 * mesma. Produção é varrida por inteiro — que é o que o contrato quer dizer.
 */
function linhasDeProducao() {
  return linhasDe([DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW], "F-41").filter(
    (l) => !l.arquivo.includes("__tests__"),
  )
}

function sobFuso<T>(tz: string, fn: () => T): T {
  const original = process.env.TZ
  try {
    process.env.TZ = tz
    return fn()
  } finally {
    process.env.TZ = original
  }
}

/** Um recorte de uma pessoa só, com os carimbos exatos, e a faixa em que caiu. */
function participacaoDe(carimbos: readonly string[]): string | null {
  const { participacao } = computePadroesTendencias({
    agoraISO: "2026-08-17T12:00:00.000Z",
    periodoDias: 30,
    gestorId: "gestor-1",
    escopo: ["a"],
    alunos: [{ id: "a", nome: "Pessoa a" }],
    atividades: carimbos.map((createdAt) => ({
      studentId: "a",
      createdAt,
      tipo: "sessao" as const,
    })),
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
  })
  return participacao.faixas.find((f) => f.pessoas === 1)?.id ?? null
}

describe("F-41 · agrupamento por dia UTC", () => {
  it("INVARIÂNCIA — a camada não usa API de data sensível ao fuso", () => {
    const padrao = new RegExp(PROIBIDOS.map((t) => t.replace("(", "\\(")).join("|"))
    const achados = casam(linhasDeProducao(), padrao)
    expect(achados.length, formatar(achados)).toBe(0)
  })

  it("VARIÂNCIA — o detector enxergaria a chamada proibida", () => {
    const padrao = new RegExp(PROIBIDOS.map((t) => t.replace("(", "\\(")).join("|"))
    expect(padrao.test(`const d = new Date(x).${PROIBIDOS[0]}("pt-BR")`)).toBe(true)
  })

  it("INVARIÂNCIA — dois fusos extremos produzem a MESMA série", () => {
    const entrada = cenario({
      pessoas: [
        { id: "a", sessoes: [1, 3, 8, 10] },
        { id: "b", sessoes: [2, 9, 16] },
      ],
    })
    const leste = sobFuso("Pacific/Kiritimati", () => computePadroesTendencias(entrada))
    const oeste = sobFuso("Pacific/Midway", () => computePadroesTendencias(entrada))
    expect(JSON.stringify(oeste.serie)).toBe(JSON.stringify(leste.serie))
    expect(JSON.stringify(oeste.participacao)).toBe(JSON.stringify(leste.participacao))
  })

  it("VARIÂNCIA — cruzar a meia-noite UTC muda a CLASSIFICAÇÃO da pessoa", () => {
    // O contrato ilustra a variância com "23:59Z → 00:01Z muda a semana". Nesta
    // tela isso seria FALSO por construção, e vale registrar em vez de fingir:
    // o balde semanal termina em `atualFim`, que é o instante "agora" (12:00Z),
    // não a meia-noite — os dois carimbos caem no MESMO balde.
    //
    // O que a chave de dia UTC realmente governa é a contagem de DIAS DISTINTOS
    // por semana, e é ali que a variância é real: os mesmos dois carimbos, com
    // duas horas de diferença, produzem 1 dia ou 2 conforme cruzem a meia-noite
    // UTC — e 2 dias em duas semanas é exatamente a fronteira da regularidade.
    const mesmoDia = participacaoDe([
      "2026-08-12T21:00:00.000Z",
      "2026-08-12T23:00:00.000Z",
      "2026-08-05T21:00:00.000Z",
      "2026-08-05T23:00:00.000Z",
    ])
    const cruzandoMeiaNoite = participacaoDe([
      "2026-08-12T23:00:00.000Z",
      "2026-08-13T01:00:00.000Z",
      "2026-08-05T23:00:00.000Z",
      "2026-08-06T01:00:00.000Z",
    ])
    expect(mesmoDia).not.toBe(cruzandoMeiaNoite)
    expect(cruzandoMeiaNoite).toBe("2x-ou-mais")
  })

  it("VARIÂNCIA — a bucketização também não é constante no eixo do tempo", () => {
    // O mesmo evento, dois minutos depois, cai em OUTRO balde — desde que os
    // dois minutos cruzem a fronteira real, que é 12:00Z (o instante "agora"),
    // e não a meia-noite.
    const fronteira = (iso: string) => ({
      agoraISO: "2026-08-17T12:00:00.000Z",
      periodoDias: 30,
      gestorId: "gestor-1",
      escopo: ["a"],
      alunos: [{ id: "a", nome: "Pessoa a" }],
      atividades: [
        { studentId: "a", createdAt: iso, tipo: "sessao" as const },
        { studentId: "a", createdAt: "2026-08-16T10:00:00.000Z", tipo: "sessao" as const },
        { studentId: "a", createdAt: "2026-07-20T10:00:00.000Z", tipo: "sessao" as const },
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
    })

    const antesDaVirada = computePadroesTendencias(fronteira("2026-08-10T11:59:00.000Z"))
    const depoisDaVirada = computePadroesTendencias(fronteira("2026-08-10T12:01:00.000Z"))
    const serieAntes = antesDaVirada.serie.pontos.map((p) => p.sessoes)
    const serieDepois = depoisDaVirada.serie.pontos.map((p) => p.sessoes)
    expect(serieDepois).not.toEqual(serieAntes)
    // E o total não muda: o carimbo mudou de balde, não de existência.
    expect(serieDepois.reduce((s, v) => s + v, 0)).toBe(serieAntes.reduce((s, v) => s + v, 0))
  })
})
