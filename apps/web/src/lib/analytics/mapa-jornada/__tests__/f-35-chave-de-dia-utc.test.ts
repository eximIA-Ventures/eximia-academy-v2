import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  NOMES_CHAVE_DIA,
  calcular,
  carregarModuloMapa,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * F-35 · I-6 — chave de dia UTC e determinismo de "há N dias".
 *
 * `Parado há 93 dias` e `14 dias atrás` são renderizados no servidor e podem ser
 * recalculados no cliente. Se a chave do dia ler o fuso do processo, o MESMO
 * dado produz números diferentes nos dois lados e a coluna passa a oscilar sem
 * ninguém ter tocado no banco.
 *
 * ANTI-VACUIDADE (teste 1): prova que `process.env.TZ` de fato muda o
 *   comportamento de `Date` neste runtime. Sem isso, todos os testes de fuso
 *   abaixo seriam teatro — passariam sem ter testado nada.
 * INVARIÂNCIA: `Travados` (F-14), `Parado há` (F-19) e `Última atividade`
 *   (F-20) são idênticos em UTC, São Paulo e Kiritimati (UTC+14).
 * VARIÂNCIA: 40 minutos que cruzam a meia-noite UTC são DOIS dias; 21 horas
 *   dentro do mesmo dia UTC colapsam em UM. O par prova que a função conta DIAS
 *   e não milissegundos divididos por 86.400.000.
 *
 * Fonte: CONTRATO-mapa.md F-35 · INVARIANTES.md I-6.
 */

const TZ_ORIGINAL = process.env.TZ

const ANTES_DA_MEIA_NOITE = "2026-08-10T23:30:00.000Z"
const DEPOIS_DA_MEIA_NOITE = "2026-08-11T00:30:00.000Z"
const MESMO_DIA_UTC = "2026-08-10T02:15:00.000Z"

const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Kiritimati"] as const

async function chaveDia(): Promise<(ms: number) => string> {
  const mod = await carregarModuloMapa()
  return resolverExport<(ms: number) => string>(mod, "chave de dia UTC", NOMES_CHAVE_DIA)
}

function comFuso<T>(tz: string, corpo: () => T): T {
  process.env.TZ = tz
  try {
    return corpo()
  } finally {
    process.env.TZ = TZ_ORIGINAL
  }
}

describe("F-35 · a chave de dia é UTC e o 'há N dias' é estável entre máquinas", () => {
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
      "process.env.TZ não afeta Date neste runtime: os testes de fuso seriam vacuosos",
    ).not.toBe(horaUtc)
  })

  it("INVARIÂNCIA — a chave de 23h30Z é o dia 10 em qualquer fuso", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      expect(
        comFuso(tz, () => fn(Date.parse(ANTES_DA_MEIA_NOITE))),
        tz,
      ).toBe("2026-08-10")
    }
  })

  it("VARIÂNCIA — 40 minutos cruzando a meia-noite UTC são DOIS dias", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      const distintos = comFuso(
        tz,
        () =>
          new Set([fn(Date.parse(ANTES_DA_MEIA_NOITE)), fn(Date.parse(DEPOIS_DA_MEIA_NOITE))]).size,
      )
      expect(distintos, tz).toBe(2)
    }
  })

  it("VARIÂNCIA — 21 horas dentro do mesmo dia UTC colapsam em UMA chave", async () => {
    const fn = await chaveDia()
    for (const tz of FUSOS) {
      const distintos = comFuso(
        tz,
        () => new Set([fn(Date.parse(MESMO_DIA_UTC)), fn(Date.parse(ANTES_DA_MEIA_NOITE))]).size,
      )
      // Com dia LOCAL, em Kiritimati (UTC+14) estes dois cairiam em dias
      // diferentes e a contagem daria 2.
      expect(distintos, tz).toBe(1)
    }
  })

  it("INVARIÂNCIA — `Travados`, `Parado há` e `Última atividade` não mudam com o fuso", async () => {
    const base = entradaBase()
    const assinaturas: string[] = []

    for (const tz of FUSOS) {
      process.env.TZ = tz
      const r = await calcular(base)
      assinaturas.push(
        JSON.stringify({
          travados: r.distribuicao.tiles.find((t) => t.id === "travados"),
          linhas: r.travados.linhas.map(
            (l) => `${l.alunoId}|${l.paradoHaLabel}|${l.ultimaAtividadeLabel}`,
          ),
        }),
      )
    }
    process.env.TZ = TZ_ORIGINAL

    expect(new Set(assinaturas).size, `valores por fuso:\n${assinaturas.join("\n")}`).toBe(1)
  })

  it("ANTI-VACUIDADE — a assinatura de fuso mede números de verdade", async () => {
    const r = await calcular(entradaBase())

    // Uma lista vazia seria idêntica em todo fuso, e o teste acima aplaudiria.
    expect(r.travados.linhas.length).toBeGreaterThan(0)
    expect(r.travados.linhas.some((l) => (l.paradoHaDias ?? 0) > 0)).toBe(true)
  })
})
