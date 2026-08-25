// ---------------------------------------------------------------------------
// Mapa de calor de atividade — grade dia×faixa e calendário semana×dia.
// ---------------------------------------------------------------------------
// Datas usadas nos carimbos são verificadas fora do teste (não com
// `getUTCDay()` do próprio código sob teste, senão a asserção fica
// tautológica): 2026-08-17 é segunda-feira, 2026-08-18 é terça-feira,
// 2026-08-19 é quarta-feira, 2026-08-20 é quinta-feira (conferido via
// `python3 -c "import datetime; print(datetime.date(2026,8,18).strftime('%A'))"`).
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import { carimbosDeAtividadeMultiplos, montarMapaDeCalorAtividade } from "../mapa-de-calor"
import { MAPA_DE_CALOR_MIN_ATIVIDADES, MAPA_DE_CALOR_SEMANAS_MAX } from "../parametros"
import { MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE } from "../textos"
import { temLastro } from "../tipos"
import { AGORA, fonteBase, reflexao, sessao } from "./fixture"

/** N carimbos de preenchimento (quinta 2026-08-20, horas variadas) — só para cruzar o piso de amostra sem interferir na célula sob teste. */
function preenchimento(n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const hora = (i * 2) % 24
    out.push(Date.parse(`2026-08-20T${String(hora).padStart(2, "0")}:00:00.000Z`))
  }
  return out
}

describe("Mapa de calor — limiar de amostra (SEM LASTRO)", () => {
  // Números LITERAIS abaixo (19 e 20), de propósito — não `MAPA_DE_CALOR_MIN_ATIVIDADES - 1`
  // / `MAPA_DE_CALOR_MIN_ATIVIDADES`. Um teste que DERIVA o tamanho da amostra da MESMA
  // constante que o código sob teste lê nunca morre sob mutação: mudar o piso move as duas
  // pontas juntas. (Achado da própria rodada de mutação desta tarefa: com
  // `MAPA_DE_CALOR_MIN_ATIVIDADES` rebaixado para 1, os 2 testes originais, escritos de
  // forma derivada, continuavam verdes — 0 mortos.) O terceiro teste abaixo é a trava: se
  // o piso vigente mudar de verdade, ele quebra alto e lembra de atualizar os literais.
  it("19 atividades (1 abaixo do piso vigente de 20) → SemLastro com motivo na voz do aluno", () => {
    const carimbos = preenchimento(19)
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    expect(temLastro(r)).toBe(false)
    if (!temLastro(r)) expect(r.motivo).toBe(MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE)
  })

  it("20 atividades (o piso vigente) → devolve a grade, não SemLastro", () => {
    const carimbos = preenchimento(20)
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    expect(temLastro(r)).toBe(true)
  })

  it("trava de coerência: o piso vigente ainda é 20 — mudou? atualize os literais acima também", () => {
    expect(MAPA_DE_CALOR_MIN_ATIVIDADES).toBe(20)
  })
})

describe("Mapa de calor — grade dia×faixa", () => {
  it("3 sessões na MESMA faixa contam 3, não 1 (nunca dedup por célula)", () => {
    // segunda 2026-08-17, 10h/10h30/11h45 UTC → mesma célula: diaSemana=1 (segunda), faixa=5 (10h–12h).
    const alvo = [
      Date.parse("2026-08-17T10:00:00.000Z"),
      Date.parse("2026-08-17T10:30:00.000Z"),
      Date.parse("2026-08-17T11:45:00.000Z"),
    ]
    const carimbos = [...alvo, ...preenchimento(17)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    expect(temLastro(r)).toBe(true)
    if (temLastro(r)) {
      const celula = r.grade.celulas[1]?.[5]
      expect(celula?.contagem).toBe(3)
      expect(celula?.diaSemana).toBe(1)
      expect(celula?.faixa).toBe(5)
    }
  })

  it("PAR VERMELHO (variância): 5 sessões na mesma faixa → 5, não 3 fixo", () => {
    const alvo = Array.from({ length: 5 }, (_, i) =>
      Date.parse(`2026-08-17T10:${String(i * 5).padStart(2, "0")}:00.000Z`),
    )
    const carimbos = [...alvo, ...preenchimento(15)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    if (temLastro(r)) expect(r.grade.celulas[1]?.[5]?.contagem).toBe(5)
  })

  it("grade sempre tem as 84 células (7×12), mesmo as vazias — nunca esparsa", () => {
    const r = montarMapaDeCalorAtividade(preenchimento(MAPA_DE_CALOR_MIN_ATIVIDADES), AGORA, 0, 12)
    if (temLastro(r)) {
      expect(r.grade.celulas).toHaveLength(7)
      for (const linha of r.grade.celulas) expect(linha).toHaveLength(12)
    }
  })

  it("fusos de borda: 23h e 01h locais caem em dias da semana DIFERENTES (offset BRT −180min)", () => {
    // UTC 2026-08-19T02:30Z → local (UTC−3h) = terça 18/08 23h30 → diaSemana=2 (terça), faixa=11.
    // UTC 2026-08-19T04:30Z → local (UTC−3h) = quarta 19/08 01h30 → diaSemana=3 (quarta), faixa=0.
    const noturna = Date.parse("2026-08-19T02:30:00.000Z")
    const madrugada = Date.parse("2026-08-19T04:30:00.000Z")
    const carimbos = [noturna, madrugada, ...preenchimento(18)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, -180, 12)
    expect(temLastro(r)).toBe(true)
    if (temLastro(r)) {
      expect(r.grade.celulas[2]?.[11]?.contagem).toBe(1) // terça 23h
      expect(r.grade.celulas[3]?.[0]?.contagem).toBe(1) // quarta 01h
    }
  })

  it("PAR VERMELHO: os MESMOS 2 carimbos, SEM offset (fuso 0), caem no MESMO dia UTC (quarta) — prova que o offset é quem separa os dois", () => {
    const noturna = Date.parse("2026-08-19T02:30:00.000Z")
    const madrugada = Date.parse("2026-08-19T04:30:00.000Z")
    const carimbos = [noturna, madrugada, ...preenchimento(18)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    if (temLastro(r)) {
      // Sem offset, ambos caem em quarta (dia 3): 02h30 → faixa 1, 04h30 → faixa 2.
      expect(r.grade.celulas[3]?.[1]?.contagem).toBe(1)
      expect(r.grade.celulas[3]?.[2]?.contagem).toBe(1)
      expect(r.grade.celulas[2]?.[11]?.contagem).toBe(0) // nada em terça — o offset é que move para lá
    }
  })

  it("o máximo é o maior valor REAL de uma célula, não um chute", () => {
    const cincoNaMesmaCelula = Array.from({ length: 5 }, (_, i) =>
      Date.parse(`2026-08-17T10:${String(i * 5).padStart(2, "0")}:00.000Z`),
    )
    const carimbos = [...cincoNaMesmaCelula, ...preenchimento(15)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 12)
    if (temLastro(r)) {
      expect(r.grade.maximo).toBe(5)
      const maiorCelula = Math.max(...r.grade.celulas.flat().map((c) => c.contagem))
      expect(r.grade.maximo).toBe(maiorCelula)
    }
  })
})

describe("Mapa de calor — calendário semana×dia", () => {
  it("mesmos fusos de borda também separam o DIA do calendário corretamente", () => {
    const noturna = Date.parse("2026-08-19T02:30:00.000Z") // local: 18/08 23h30
    const madrugada = Date.parse("2026-08-19T04:30:00.000Z") // local: 19/08 01h30
    // Preenchimento LONGE de 18/19-08 (2026-08-24, ±1 dia com offset −180 nunca toca 18 nem 19)
    // — `preenchimento()` comum usa horas 0h/2h que, com este MESMO offset, vazariam para
    // 08-19 e contaminariam a asserção (achado do próprio teste rodando).
    const distante = Array.from({ length: 18 }, (_, i) =>
      Date.parse(`2026-08-24T${String((i * 2) % 24).padStart(2, "0")}:00:00.000Z`),
    )
    const carimbos = [noturna, madrugada, ...distante]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, -180, 4)
    expect(temLastro(r)).toBe(true)
    if (temLastro(r)) {
      const todosOsDias = r.calendario.semanas.flatMap((s) => s.dias)
      const dia18 = todosOsDias.find((d) => d.diaUtc === "2026-08-18")
      const dia19 = todosOsDias.find((d) => d.diaUtc === "2026-08-19")
      expect(dia18?.contagem).toBe(1)
      expect(dia19?.contagem).toBe(1)
    }
  })

  it("cada semana tem exatamente 7 dias, domingo a sábado", () => {
    const r = montarMapaDeCalorAtividade(preenchimento(MAPA_DE_CALOR_MIN_ATIVIDADES), AGORA, 0, 3)
    if (temLastro(r)) {
      expect(r.calendario.semanas).toHaveLength(3)
      for (const semana of r.calendario.semanas) expect(semana.dias).toHaveLength(7)
    }
  })

  it("PAR VERMELHO: pedir mais semanas que o teto devolve no máximo MAPA_DE_CALOR_SEMANAS_MAX", () => {
    const r = montarMapaDeCalorAtividade(preenchimento(MAPA_DE_CALOR_MIN_ATIVIDADES), AGORA, 0, 999)
    if (temLastro(r)) expect(r.calendario.semanas).toHaveLength(MAPA_DE_CALOR_SEMANAS_MAX)
  })

  it("o calendário cobre o período do filtro — atividade FORA da janela de semanas não conta no calendário (mas conta na grade)", () => {
    const dentro = Date.parse("2026-08-17T10:00:00.000Z")
    const foraDaJanela = Date.parse("2020-01-06T10:00:00.000Z") // segunda, ~6 anos antes de AGORA
    const carimbos = [dentro, foraDaJanela, ...preenchimento(18)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 1) // só 1 semana de calendário
    if (temLastro(r)) {
      const somaCalendario = r.calendario.semanas
        .flatMap((s) => s.dias)
        .reduce((acc, d) => acc + d.contagem, 0)
      // `dentro` e o preenchimento (quinta 2026-08-20) caem na semana [16/08, 23/08) que termina
      // em AGORA (sexta 21/08); só `foraDaJanela` (2020) fica de fora — por isso a soma do
      // calendário é estritamente menor que o total de carimbos, nunca igual.
      expect(somaCalendario).toBeLessThan(carimbos.length)
      // mas a GRADE enxerga os 20 carimbos inteiros, sem recorte de janela — `dentro` sozinho
      // já garante ao menos 1 na célula segunda/faixa-5.
      expect(r.grade.celulas[1]?.[5]?.contagem).toBeGreaterThanOrEqual(1)
    }
  })

  it("o máximo do calendário é o maior valor REAL de um dia, não um chute", () => {
    const tresNoMesmoDia = [
      Date.parse("2026-08-17T10:00:00.000Z"),
      Date.parse("2026-08-17T14:00:00.000Z"),
      Date.parse("2026-08-17T20:00:00.000Z"),
    ]
    const carimbos = [...tresNoMesmoDia, ...preenchimento(17)]
    const r = montarMapaDeCalorAtividade(carimbos, AGORA, 0, 2)
    if (temLastro(r)) {
      const maiorDia = Math.max(
        ...r.calendario.semanas.flatMap((s) => s.dias).map((d) => d.contagem),
      )
      expect(r.calendario.maximo).toBe(maiorDia)
      expect(r.calendario.maximo).toBeGreaterThanOrEqual(3)
    }
  })
})

describe("Mapa de calor — escopo (aluno vs. time, mesmo cálculo)", () => {
  it("carimbosDeAtividadeMultiplos mescla vários alunos sem repetir a lógica de união do aluno único", () => {
    const aluno1 = fonteBase({
      sessoes: [sessao({ created_at: "2026-08-17T10:00:00.000Z" })],
      reflexoes: [reflexao({ created_at: "2026-08-17T11:00:00.000Z" })],
    })
    const aluno2 = fonteBase({
      sessoes: [sessao({ created_at: "2026-08-18T09:00:00.000Z" })],
    })
    const carimbos = carimbosDeAtividadeMultiplos([aluno1, aluno2])
    expect(carimbos).toHaveLength(3)
    expect(carimbos).toContain(Date.parse("2026-08-17T10:00:00.000Z"))
    expect(carimbos).toContain(Date.parse("2026-08-17T11:00:00.000Z"))
    expect(carimbos).toContain(Date.parse("2026-08-18T09:00:00.000Z"))
  })

  it("o MESMO montarMapaDeCalorAtividade aceita carimbos de 1 aluno OU de vários — sem branch de escopo", () => {
    const fontes = Array.from({ length: 20 }, (_, i) =>
      fonteBase({
        sessoes: [
          sessao({ created_at: `2026-08-17T${String(10 + (i % 12)).padStart(2, "0")}:00:00.000Z` }),
        ],
      }),
    )
    const carimbosDoTime = carimbosDeAtividadeMultiplos(fontes)
    expect(carimbosDoTime.length).toBeGreaterThanOrEqual(MAPA_DE_CALOR_MIN_ATIVIDADES)
    const r = montarMapaDeCalorAtividade(carimbosDoTime, AGORA, 0, 4)
    expect(temLastro(r)).toBe(true)
  })
})
