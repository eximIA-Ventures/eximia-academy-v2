import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_CHAVE_DIA,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * I-6 · Chave de dia é UTC e estável entre máquinas.
 *
 * INVARIÂNCIA (testes 2 e 3): a chave de dia de um instante é a MESMA sob
 *   qualquer fuso do processo, inclusive para timestamps que cruzam a
 *   meia-noite UTC (21h em São Paulo já é o dia seguinte em UTC).
 * VARIÂNCIA (testes 4 e 5): a chave TEM que mudar quando o dia UTC muda, e
 *   dois instantes do mesmo dia UTC TÊM que colapsar em uma chave só. Sem
 *   isso, `() => "2026-08-10"` passaria em toda invariância de fuso.
 * ANTI-VACUIDADE (teste 1): prova que o processo de teste realmente troca de
 *   fuso. Se não trocasse, os testes de fuso seriam teatro.
 * INTEGRAÇÃO (teste 6): a contagem de DIAS DISTINTOS que alimenta a
 *   Regularidade (§8.2) não muda com o fuso do processo.
 *
 * Fonte: INVARIANTES.md I-6 · area-gestor.ts:224.
 */

const TZ_ORIGINAL = process.env.TZ

/** 23h30 UTC do dia 10 e 00h30 UTC do dia 11 — 40 min de distância, 2 dias UTC. */
const ANTES_DA_MEIA_NOITE = "2026-08-10T23:30:00.000Z"
const DEPOIS_DA_MEIA_NOITE = "2026-08-11T00:30:00.000Z"
const MESMO_DIA_UTC = "2026-08-10T02:15:00.000Z"

const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Kiritimati"] as const

async function chaveDia(): Promise<(iso: string | number) => string> {
  const mod = await carregarModulo()
  return resolverExport<(iso: string | number) => string>(mod, "chave de dia UTC", NOMES_CHAVE_DIA)
}

async function calcular(entrada: EntradaVisaoGeral): Promise<{
  placar: { metricas: ReadonlyArray<{ id: string; valorPrincipal: string; numerador: number }> }
}> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar(fn, entrada)
}

function comFuso<T>(tz: string, corpo: () => T): T {
  process.env.TZ = tz
  try {
    return corpo()
  } finally {
    process.env.TZ = TZ_ORIGINAL
  }
}

describe("I-6 · chave de dia é UTC e estável entre máquinas", () => {
  beforeAll(() => {
    process.env.TZ = TZ_ORIGINAL
  })
  afterAll(() => {
    process.env.TZ = TZ_ORIGINAL
  })

  it("ANTI-VACUIDADE — o processo de teste realmente muda de fuso", () => {
    const t = Date.parse(ANTES_DA_MEIA_NOITE)
    const horaUtc = comFuso("UTC", () => new Date(t).getHours())
    const horaTokyo = comFuso("Asia/Tokyo", () => new Date(t).getHours())

    expect(
      horaTokyo,
      "process.env.TZ não afeta Date neste runtime: os testes de fuso abaixo seriam vacuosos",
    ).not.toBe(horaUtc)
  })

  it("INVARIÂNCIA — a chave de 23h30Z é o dia 10 em qualquer fuso", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      // Em São Paulo são 20h30 do dia 10; em Kiritimati, 13h30 do dia 11.
      // A chave é UTC, então é sempre 2026-08-10.
      expect(
        comFuso(tz, () => fn(ANTES_DA_MEIA_NOITE)),
        tz,
      ).toBe("2026-08-10")
    }
  })

  it("INVARIÂNCIA — a chave de 00h30Z é o dia 11 em qualquer fuso", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      expect(
        comFuso(tz, () => fn(DEPOIS_DA_MEIA_NOITE)),
        tz,
      ).toBe("2026-08-11")
    }
  })

  it("VARIÂNCIA — 40 minutos que cruzam a meia-noite UTC são DOIS dias distintos", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      const distintos = comFuso(
        tz,
        () => new Set([fn(ANTES_DA_MEIA_NOITE), fn(DEPOIS_DA_MEIA_NOITE)]).size,
      )
      expect(distintos, tz).toBe(2)
    }
  })

  it("VARIÂNCIA — 21 horas dentro do mesmo dia UTC colapsam em UMA chave", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      const distintos = comFuso(
        tz,
        () => new Set([fn(MESMO_DIA_UTC), fn(ANTES_DA_MEIA_NOITE)]).size,
      )
      // Se a implementação usasse o dia LOCAL, em Kiritimati (UTC+14) estes
      // dois instantes cairiam em dias diferentes e a contagem daria 2.
      expect(distintos, tz).toBe(1)
    }
  })

  it("INTEGRAÇÃO — a Regularidade não muda com o fuso do processo", async () => {
    const base = entradaBase()
    const resultados: string[] = []
    for (const tz of FUSOS) {
      process.env.TZ = tz
      const r = await calcular(base)
      const regularidade = r.placar.metricas.find((m) => m.id === "regularidade")
      resultados.push(`${regularidade?.valorPrincipal}/${regularidade?.numerador}`)
    }
    process.env.TZ = TZ_ORIGINAL

    expect(new Set(resultados).size, `valores por fuso: ${resultados.join(" · ")}`).toBe(1)
  })
})
