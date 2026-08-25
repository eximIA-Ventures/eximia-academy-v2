// ---------------------------------------------------------------------------
// Tela 3 — Meu Mapa da Jornada. Um teste por linha do contrato (3.1–3.9).
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import { moduloAtualId, montarMapaAutogestao, statusDoModulo } from "../montagem"
import { temLastro } from "../tipos"
import {
  AGORA,
  capitulo,
  fonteBase,
  haDias,
  moduloDuracao,
  plano,
  progresso,
  sessao,
} from "./fixture"

describe("3.1 — Minha jornada nos módulos (trilha, sem NENHUM vermelho)", () => {
  it("3 concluídos, 1 em andamento, 3 não iniciados — na ordem exata do curso", () => {
    const caps = Array.from({ length: 7 }, (_, i) => capitulo(i + 1))
    const prog = [
      progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(20) }),
      progresso({ chapter_id: caps[1].id, reached_last_slide_at: haDias(15) }),
      progresso({ chapter_id: caps[2].id, reached_last_slide_at: haDias(10) }),
      progresso({ chapter_id: caps[3].id, first_viewed_at: haDias(5) }), // em andamento, sem reached_last_slide_at
    ]
    const fonte = fonteBase({ capitulos: caps, progresso: prog })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.trilha.modulos.map((m) => m.status)).toEqual([
      "concluido",
      "concluido",
      "concluido",
      "em-andamento",
      "nao-iniciado",
      "nao-iniciado",
      "nao-iniciado",
    ])
    // §22: nenhum "vermelho" — o tipo nem admite esse valor, então a prova é
    // que todo status pertence exatamente aos 3 rótulos permitidos.
    for (const m of r.trilha.modulos) {
      expect(["concluido", "em-andamento", "nao-iniciado"]).toContain(m.status)
    }
  })

  it("statusDoModulo: PAR VERMELHO — sem NENHUM progresso, é 'não iniciado', nunca 'concluído' por engano", () => {
    expect(statusDoModulo(undefined)).toBe("nao-iniciado")
  })
})

describe("3.2 — Progresso do módulo atual", () => {
  it("6 de 10 slides → 60%", () => {
    const caps = [capitulo(1), capitulo(2)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(20) }),
        progresso({
          chapter_id: caps[1].id,
          first_viewed_at: haDias(5),
          max_slide_index: 6,
          slides_total_at_last_view: 10,
        }),
      ],
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.progressoPercent).toBe(60)
  })

  it("PAR VERMELHO (variância): 3 de 10 slides → 30%, não 60% fixo", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({
          chapter_id: caps[0].id,
          first_viewed_at: haDias(5),
          max_slide_index: 3,
          slides_total_at_last_view: 10,
        }),
      ],
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.progressoPercent).toBe(30)
  })
})

describe("3.3 — Iniciado em (data, no fuso do tenant)", () => {
  it("data conhecida → a MESMA data formatada dd/mm/aaaa", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, first_viewed_at: "2026-08-01T12:00:00.000Z" }),
      ],
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.iniciadoEmRotulo).toBe("01/08/2026")
  })

  it("PAR VERMELHO (variância): outra data conhecida → outro rótulo, não fixo", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, first_viewed_at: "2026-03-15T12:00:00.000Z" }),
      ],
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.iniciadoEmRotulo).toBe("15/03/2026")
  })
})

describe("3.4 — Sessões concluídas do módulo atual", () => {
  it("2 concluídas e 1 aberta → '2 de 3'", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [progresso({ chapter_id: caps[0].id, first_viewed_at: haDias(5) })],
      sessoes: [
        sessao({ chapter_id: caps[0].id, created_at: haDias(4), completed_at: haDias(4) }),
        sessao({ chapter_id: caps[0].id, created_at: haDias(3), completed_at: haDias(3) }),
        sessao({ chapter_id: caps[0].id, created_at: haDias(1) }), // em aberto
      ],
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.sessoesConcluidas).toBe(2)
    expect(r.moduloAtual.conteudo?.sessoesTotal).toBe(3)
  })
})

describe("3.5 — Estimativa restante (slides restantes × duração média medida)", () => {
  it("4 slides restantes com média conhecida (5 min) → o produto (20 min)", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({
          chapter_id: caps[0].id,
          first_viewed_at: haDias(5),
          max_slide_index: 6,
          slides_total_at_last_view: 10,
        }),
      ],
      duracaoMediaPorSlideMinutos: 5,
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.estimativaRestanteMinutos).toBe(20)
  })

  it("PAR VERMELHO: sem duração média medida (null) → estimativa é null, nunca um número inventado", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({
          chapter_id: caps[0].id,
          first_viewed_at: haDias(5),
          max_slide_index: 6,
          slides_total_at_last_view: 10,
        }),
      ],
      duracaoMediaPorSlideMinutos: null,
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.moduloAtual.conteudo?.estimativaRestanteMinutos).toBeNull()
  })
})

describe("3.6 — Meu próximo marco (data, ou SEM LASTRO)", () => {
  it("plano com 20 dias no módulo atual → a data prevista", () => {
    const caps = [capitulo(1), capitulo(2)]
    const inicio = haDias(30)
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(25) }),
        progresso({ chapter_id: caps[1].id, first_viewed_at: haDias(5) }),
      ],
      plano: plano({
        startDateISO: inicio,
        moduleDurations: [moduloDuracao(caps[0].id, 0), moduloDuracao(caps[1].id, 20)],
      }),
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    const conteudo = r.proximoMarco.conteudo
    if (!conteudo) throw new Error("esperava conteúdo em proximoMarco")
    expect(temLastro(conteudo.prazo)).toBe(true)
    if (temLastro(conteudo.prazo)) {
      const esperado = new Date(Date.parse(inicio) + 20 * 86_400_000).toISOString()
      expect(conteudo.prazo.dataISO).toBe(esperado)
    }
  })

  it("PAR VERMELHO: módulo do plano com days: 0 → SEM LASTRO, nunca uma data inventada", () => {
    const caps = [capitulo(1), capitulo(2)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(25) }),
        progresso({ chapter_id: caps[1].id, first_viewed_at: haDias(5) }),
      ],
      plano: plano({
        startDateISO: haDias(30),
        moduleDurations: [moduloDuracao(caps[0].id, 0), moduloDuracao(caps[1].id, 0)],
      }),
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(temLastro(r.proximoMarco.conteudo?.prazo)).toBe(false)
  })
})

describe("3.7 / 3.8 — Onde costumo perder ritmo e a média de pausa", () => {
  it("2 pausas (8d e 10d) logo após início de módulo → aparece o texto e a média é 9", () => {
    const caps = [capitulo(1), capitulo(2), capitulo(3)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, first_viewed_at: "2026-01-01T12:00:00.000Z" }),
        progresso({ chapter_id: caps[1].id, first_viewed_at: "2026-01-20T12:00:00.000Z" }),
      ],
      sessoes: [
        "2026-01-01",
        "2026-01-02", // pausa de 8d até 01-10 (logo após o início do módulo 1)
        "2026-01-10",
        "2026-01-20",
        "2026-01-21", // pausa de 10d até 01-31 (logo após o início do módulo 2)
        "2026-01-31",
      ].map((d) => sessao({ created_at: `${d}T12:00:00.000Z` })),
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.perdaDeRitmo.estado).toBe("ok")
    expect(r.perdaDeRitmo.conteudo?.mediaDiasPausa).toBe(9)
  })

  it("PAR VERMELHO: só 1 ocorrência → supressão (não vira 'padrão' com uma amostra só)", () => {
    const caps = [capitulo(1)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, first_viewed_at: "2026-01-01T12:00:00.000Z" }),
      ],
      sessoes: ["2026-01-01", "2026-01-02", "2026-01-10"].map((d) =>
        sessao({ created_at: `${d}T12:00:00.000Z` }),
      ),
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.perdaDeRitmo.estado).toBe("vazio")
    expect(r.perdaDeRitmo.conteudo).toBeNull()
  })

  it("a mesma pausa NÃO conta se não aconteceu logo após início de módulo (janela de 3 dias)", () => {
    const caps = [capitulo(1), capitulo(2)]
    const fonte = fonteBase({
      capitulos: caps,
      progresso: [
        progresso({ chapter_id: caps[0].id, first_viewed_at: "2026-01-01T12:00:00.000Z" }),
        progresso({ chapter_id: caps[1].id, first_viewed_at: "2026-01-20T12:00:00.000Z" }),
      ],
      // Gap de 10 dias entre 01-10 e 01-20 — mas nem próximo do início do
      // módulo 1 (01-01) nem do módulo 2 (que só começa DEPOIS do gap).
      sessoes: [
        "2026-01-01",
        "2026-01-02",
        "2026-01-10",
        "2026-01-20",
        "2026-01-21",
        "2026-01-31",
      ].map((d) => sessao({ created_at: `${d}T12:00:00.000Z` })),
    })
    const r = montarMapaAutogestao(fonte, AGORA)
    // As DUAS pausas que sobrevivem são só as ancoradas em início de módulo (8 e 10) —
    // a pausa de 10d ENTRE 01-10 e 01-20 (que não está ancorada em nenhum início) fica de fora.
    expect(r.perdaDeRitmo.conteudo?.mediaDiasPausa).toBe(9)
  })
})

describe("3.9 — Histórico recente dos módulos (últimos 3, na ordem, nunca ranking)", () => {
  it("5 módulos iniciados → exatamente os 3 mais recentes, do mais novo ao mais antigo", () => {
    const caps = Array.from({ length: 5 }, (_, i) => capitulo(i + 1))
    const prog = [
      progresso({ chapter_id: caps[0].id, first_viewed_at: haDias(50) }),
      progresso({ chapter_id: caps[1].id, first_viewed_at: haDias(40) }),
      progresso({ chapter_id: caps[2].id, first_viewed_at: haDias(30) }),
      progresso({ chapter_id: caps[3].id, first_viewed_at: haDias(20) }),
      progresso({ chapter_id: caps[4].id, first_viewed_at: haDias(10) }),
    ]
    const fonte = fonteBase({ capitulos: caps, progresso: prog })
    const r = montarMapaAutogestao(fonte, AGORA)
    expect(r.historico.itens.map((i) => i.id)).toEqual([caps[4].id, caps[3].id, caps[2].id])
  })
})

describe("moduloAtualId — o primeiro não concluído, na ordem do curso", () => {
  it("todos concluídos → null (jornada concluída)", () => {
    const caps = [capitulo(1), capitulo(2)]
    const progressoPorId = new Map(
      [
        progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(10) }),
        progresso({ chapter_id: caps[1].id, reached_last_slide_at: haDias(5) }),
      ].map((p) => [p.chapter_id, p] as const),
    )
    expect(moduloAtualId(caps, progressoPorId)).toBeNull()
  })
})
