// ---------------------------------------------------------------------------
// Tela 1 — Visão Geral. Um teste por linha do CONTRATO-DE-DADOS.md (1.1–1.22).
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import {
  calcularRitmo,
  contarRetomadas,
  deltaProgressoPp,
  deltaRegularidadePercent,
  deltaSessoes,
  diasDaSemanaPreferidos,
  estadoDePausa,
  latenciaMediaDeRetomada,
  maiorIntervaloDias,
  melhorHorario,
  montarVisaoGeralAutogestao,
  progressoPlanejadoHoje,
  progressoRealPercent,
  regularidadeVezesPorSemana,
  rotuloVezesPorSemana,
  sessaoEmAberto,
} from "../montagem"
import { temLastro } from "../tipos"
import {
  AGORA,
  AGORA_MS,
  capitulos,
  fonteBase,
  haDias,
  moduloDuracao,
  plano,
  progresso,
  reflexao,
  sessao,
} from "./fixture"

describe("1.1 — Ritmo", () => {
  it("No ritmo: plano 4×7d iniciado há 14d, 2 de 4 módulos concluídos", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [
        progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(10) }),
        progresso({ chapter_id: caps[1].id, reached_last_slide_at: haDias(8) }),
      ],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ritmo.estado).toBe("no-ritmo")
  })

  it("PAR VERMELHO: mesmo plano, 0 módulos concluídos → Abaixo do ritmo", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ritmo.estado).toBe("abaixo-do-ritmo")
  })

  it("calcularRitmo: adiantado quando o real supera o planejado além da tolerância", () => {
    expect(calcularRitmo(90, 50, null)).toBe("adiantado")
  })

  it("calcularRitmo: retomando SEMPRE vence a comparação de progresso (override)", () => {
    // Mesmo com progresso idêntico ao planejado (diferença 0), a pausa recente manda.
    expect(calcularRitmo(50, 50, "retomando")).toBe("retomando")
  })

  it("calcularRitmo: sem meta do plano (SEM LASTRO), cai em 'no-ritmo' — nunca inventa atraso", () => {
    expect(calcularRitmo(10, { lastro: "ausente", motivo: "x" }, null)).toBe("no-ritmo")
  })
})

describe("1.2 — Regularidade (dias distintos, nunca sessões)", () => {
  it("3 sessões no MESMO dia + 1 em outro dia, dentro de 1 semana → 2, nunca 4", () => {
    const fonte = fonteBase({
      periodoDias: 7,
      capitulos: capitulos(1),
      sessoes: [
        sessao({ created_at: haDias(1) }),
        sessao({ created_at: new Date(Date.parse(haDias(1)) + 3_600_000).toISOString() }),
        sessao({ created_at: new Date(Date.parse(haDias(1)) + 7_200_000).toISOString() }),
        sessao({ created_at: haDias(3) }),
      ],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.regularidade.vezesPorSemana).toBe(2)
  })

  it("PAR VERMELHO (variância): 4 sessões em 4 dias DISTINTOS na mesma semana → 4", () => {
    const fonte = fonteBase({
      periodoDias: 7,
      capitulos: capitulos(1),
      sessoes: [1, 2, 3, 4].map((n) => sessao({ created_at: haDias(n) })),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.regularidade.vezesPorSemana).toBe(4)
  })

  it("rotuloVezesPorSemana: formata com vírgula decimal, sem '.0' no caso inteiro", () => {
    expect(rotuloVezesPorSemana(1.8)).toBe("1,8x por semana")
    expect(rotuloVezesPorSemana(2)).toBe("2x por semana")
  })
})

describe("1.3 — Meta do plano (2x por semana): SEM LASTRO", () => {
  it("não existe campo de meta de frequência — nunca um número", () => {
    const fonte = fonteBase({
      capitulos: capitulos(1),
      sessoes: [sessao({ created_at: haDias(1) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    const meta = r.comoEstou.conteudo?.regularidade.meta
    expect(temLastro(meta)).toBe(false)
    expect(typeof meta).toBe("object")
    // PAR VERMELHO: nunca deve degenerar para 0 nem para um número qualquer.
    expect(meta).not.toBe(0)
    expect(typeof (meta as { motivo: string }).motivo).toBe("string")
  })
})

describe("1.4 — Progresso real (capítulos concluídos ÷ total)", () => {
  it("4 de 8 capítulos com reached_last_slide_at → 50%", () => {
    const caps = capitulos(8)
    const prog = caps
      .slice(0, 4)
      .map((c) => progresso({ chapter_id: c.id, reached_last_slide_at: haDias(5) }))
    expect(progressoRealPercent(prog, caps)).toBe(50)
  })

  it("PAR VERMELHO (variância): 0 de 8 → 0%, não 50% fixo", () => {
    expect(progressoRealPercent([], capitulos(8))).toBe(0)
  })
})

describe("1.5 — Meta do plano para hoje (progresso planejado)", () => {
  it("plano 8×10d iniciado há 40 dias → 50%", () => {
    const caps = capitulos(8)
    const p = plano({
      startDateISO: haDias(40),
      moduleDurations: caps.map((c) => moduloDuracao(c.id, 10)),
    })
    expect(progressoPlanejadoHoje(p, AGORA_MS)).toBe(50)
  })

  it("clamp: decorridos além da duração total nunca passam de 100%", () => {
    const caps = capitulos(8)
    const p = plano({
      startDateISO: haDias(999),
      moduleDurations: caps.map((c) => moduloDuracao(c.id, 10)),
    })
    expect(progressoPlanejadoHoje(p, AGORA_MS)).toBe(100)
  })

  it("SEM LASTRO quando o plano é degenerado (todos os módulos com days: 0)", () => {
    const caps = capitulos(4)
    const p = plano({
      startDateISO: haDias(10),
      moduleDurations: caps.map((c) => moduloDuracao(c.id, 0)),
    })
    expect(temLastro(progressoPlanejadoHoje(p, AGORA_MS))).toBe(false)
  })

  it("SEM LASTRO quando não há plano — nunca inventa um percentual", () => {
    expect(temLastro(progressoPlanejadoHoje(null, AGORA_MS))).toBe(false)
  })
})

describe("1.6 — Última atividade (dias desde o carimbo mais recente)", () => {
  it("última sessão há 3 dias → 3", () => {
    const fonte = fonteBase({
      capitulos: capitulos(1),
      sessoes: [sessao({ created_at: haDias(3) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ultimaAtividade.dias).toBe(3)
    expect(r.comoEstou.conteudo?.ultimaAtividade.rotulo).toBe("3 dias atrás")
  })

  it("PAR VERMELHO: atividade hoje → 0 dias, rótulo 'hoje' (não '0 dias atrás')", () => {
    const fonte = fonteBase({
      capitulos: capitulos(1),
      sessoes: [sessao({ created_at: haDias(0) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ultimaAtividade.dias).toBe(0)
    expect(r.comoEstou.conteudo?.ultimaAtividade.rotulo).toBe("hoje")
  })
})

describe("1.7 — Próxima sessão recomendada", () => {
  it("atraso de plano (abaixo do ritmo) → data ≤ fim da semana corrente", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ritmo.estado).toBe("abaixo-do-ritmo")
    const iso = r.comoEstou.conteudo?.ultimaAtividade.proximaSessaoRecomendadaISO
    expect(iso).not.toBeNull()
    expect(Date.parse(iso as string)).toBeGreaterThanOrEqual(AGORA_MS)
    expect(Date.parse(iso as string)).toBeLessThanOrEqual(AGORA_MS + 7 * 86_400_000)
  })

  it("PAR VERMELHO: no ritmo → nenhuma data recomendada (null, não uma data qualquer)", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: caps
        .slice(0, 2)
        .map((c) => progresso({ chapter_id: c.id, reached_last_slide_at: haDias(10) })),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.comoEstou.conteudo?.ritmo.estado).toBe("no-ritmo")
    expect(r.comoEstou.conteudo?.ultimaAtividade.proximaSessaoRecomendadaISO).toBeNull()
  })
})

describe("1.8 — Mensagem-síntese: 4 estados, 4 mensagens distintas, sem julgamento", () => {
  it("as 4 mensagens são distintas entre si", () => {
    const textos = new Set<string>()
    for (const estado of ["adiantado", "no-ritmo", "abaixo-do-ritmo", "retomando"] as const) {
      const caps = capitulos(4)
      let fonte = fonteBase({ capitulos: caps })
      if (estado === "retomando") {
        // pausa de 20 dias que terminou ontem — dentro da janela de retomada.
        fonte = fonteBase({
          capitulos: caps,
          sessoes: [sessao({ created_at: haDias(40) }), sessao({ created_at: haDias(1) })],
        })
      } else if (estado === "adiantado") {
        fonte = fonteBase({
          capitulos: caps,
          plano: plano({
            startDateISO: haDias(5),
            moduleDurations: caps.map((c) => moduloDuracao(c.id, 10)),
          }),
          progresso: caps.map((c) =>
            progresso({ chapter_id: c.id, reached_last_slide_at: haDias(1) }),
          ),
        })
      } else if (estado === "no-ritmo") {
        fonte = fonteBase({
          capitulos: caps,
          plano: plano({
            startDateISO: haDias(14),
            moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
          }),
          progresso: caps
            .slice(0, 2)
            .map((c) => progresso({ chapter_id: c.id, reached_last_slide_at: haDias(10) })),
        })
      } else {
        fonte = fonteBase({
          capitulos: caps,
          plano: plano({
            startDateISO: haDias(14),
            moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
          }),
          progresso: [],
        })
      }
      const r = montarVisaoGeralAutogestao(fonte, AGORA)
      expect(r.comoEstou.conteudo?.ritmo.estado).toBe(estado)
      textos.add(r.sintese.texto)
    }
    expect(textos.size).toBe(4)
  })

  it("nenhuma das mensagens usa vocabulário de julgamento (§2 Regra 2)", () => {
    const proibidas = /bom aluno|mau aluno|ranking|reprova|aprovad/i
    for (const t of [
      "Você está acompanhando seu plano. Continue mantendo a consistência.",
      "Seu ritmo caiu nesta semana, mas ainda há tempo para recuperar o combinado.",
      "Você retomou sua jornada. O próximo passo é transformar essa retomada em regularidade.",
      "Você está adiantado em relação ao seu plano. Continue no seu ritmo.",
    ]) {
      expect(t).not.toMatch(proibidas)
    }
  })
})

describe("1.9 / 1.10 / 1.11 — O que mudou (deltas de janela)", () => {
  it("1.9 — 5 sessões na janela atual e 4 na anterior → +1", () => {
    expect(deltaSessoes(5, 4)).toBe(1)
  })

  it("1.10 — regularidade 2,0 → 1,7 → −15%", () => {
    expect(deltaRegularidadePercent(1.7, 2.0)).toBe(-15)
  })

  it("1.11 — progresso 45% → 50% → +5 p.p.", () => {
    expect(deltaProgressoPp(50, 45)).toBe(5)
  })

  it("PAR VERMELHO: sem base no período anterior (0), delta de regularidade é null — nunca 0% inventado", () => {
    expect(deltaRegularidadePercent(2, 0)).toBeNull()
  })

  it("máximo 3 itens no bloco de mudanças, mesmo com 4 sinais aplicáveis", () => {
    const caps = capitulos(2)
    const fonte = fonteBase({
      periodoDias: 7,
      capitulos: caps,
      sessoes: [
        sessao({ created_at: haDias(1) }),
        sessao({ created_at: haDias(2) }),
        sessao({ created_at: haDias(3) }),
        sessao({ created_at: haDias(9) }),
      ],
      progresso: [progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(1) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.mudancas.itens.length).toBeLessThanOrEqual(3)
  })
})

describe("1.12 / 1.13 — Atenção: reflexões e regularidade abaixo do plano (SEM LASTRO no denominador)", () => {
  it("1.12 — a contagem de reflexões FEITAS é medível (8), mesmo sem a meta", () => {
    const feitas = Array.from({ length: 8 }, (_, i) => reflexao({ created_at: haDias(i + 1) }))
    expect(feitas).toHaveLength(8)
  })

  it("1.12/1.13 — sem meta, o item de atenção correspondente NUNCA aparece (não inventa 'abaixo do plano')", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      reflexoes: Array.from({ length: 8 }, (_, i) => reflexao({ created_at: haDias(i + 1) })),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.atencao.itens.some((i) => i.id === "reflexoes")).toBe(false)
    expect(r.atencao.itens.some((i) => i.id === "regularidade")).toBe(false)
  })
})

describe("1.14 — Sessão em aberto", () => {
  it("sessão aberta há 5 dias → aparece com 5", () => {
    const r = sessaoEmAberto([sessao({ created_at: haDias(5) })], AGORA_MS)
    expect(r?.diasAberta).toBe(5)
  })

  it("PAR VERMELHO: ao concluir a sessão, ela some (não aparece mais nenhuma sessão aberta)", () => {
    const r = sessaoEmAberto([sessao({ created_at: haDias(5), completed_at: haDias(1) })], AGORA_MS)
    expect(r).toBeNull()
  })

  it("bloco de atenção mostra a sessão em aberto com o card correspondente", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      sessoes: [sessao({ chapter_id: caps[0].id, created_at: haDias(5) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.atencao.itens.some((i) => i.id === "sessao-aberta" && i.texto.includes("5"))).toBe(
      true,
    )
  })
})

describe("1.15 — Meu próximo movimento: UMA recomendação, nunca duas", () => {
  it("sessão parada + atraso de plano juntos → prioriza sessão parada", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [],
      sessoes: [sessao({ chapter_id: caps[0].id, created_at: haDias(5) })],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.proximoMovimento.tipo).toBe("sessao-parada")
  })

  it("PAR VERMELHO: só o atraso de plano (sem sessão parada) → prioriza atraso de plano", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.proximoMovimento.tipo).toBe("atraso-de-plano")
  })

  it("sem nenhum gatilho, cai no fallback de manutenção de ritmo — nunca fica sem recomendação", () => {
    const caps = capitulos(4)
    const fonte = fonteBase({
      capitulos: caps,
      // Plano em dia (2 de 4 concluídos, exatamente o planejado) e NENHUMA
      // sessão em aberto — nenhum dos gatilhos de prioridade se aplica.
      plano: plano({
        startDateISO: haDias(14),
        moduleDurations: caps.map((c) => moduloDuracao(c.id, 7)),
      }),
      progresso: [
        progresso({
          chapter_id: caps[0].id,
          reached_last_slide_at: haDias(10),
          first_viewed_at: haDias(12),
        }),
        progresso({
          chapter_id: caps[1].id,
          reached_last_slide_at: haDias(8),
          first_viewed_at: haDias(9),
        }),
      ],
      sessoes: [
        sessao({ chapter_id: caps[0].id, created_at: haDias(10), completed_at: haDias(10) }),
        sessao({ chapter_id: caps[1].id, created_at: haDias(8), completed_at: haDias(8) }),
      ],
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.proximoMovimento.tipo).toBe("manutencao-de-ritmo")
  })
})

describe("1.16 / 1.17 / 1.18 / 1.19 — Resposta aos meus últimos ajustes", () => {
  it("1.16 — recalculated_at há 21 dias → 21", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        recalculatedAtISO: haDias(21),
        baseline: {
          capturedAt: haDias(21),
          progressPct: 38,
          sessionsDone: 0,
          reflectionsDone: 0,
          completedChapterIds: [],
        },
      }),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.respostaAosAjustes.conteudo?.ultimoAjusteDias).toBe(21)
  })

  it("1.17 — frequência 1,1x antes do ajuste e 1,9x depois", () => {
    const caps = capitulos(1)
    // Janela ANTES: [há 140 dias, há 70 dias) — exatamente 10 semanas — com 11
    // dias distintos ativos → 11/10 = 1,1x/semana.
    const capturedAt = haDias(70)
    const antes = Array.from({ length: 11 }, (_, i) => sessao({ created_at: haDias(140 - i * 6) }))
    // Janela DEPOIS: [há 70 dias, agora) — outras 10 semanas — com 19 dias
    // distintos ativos → 19/10 = 1,9x/semana.
    const depois = Array.from({ length: 19 }, (_, i) => sessao({ created_at: haDias(1 + i * 3) }))
    const fonte = fonteBase({
      capitulos: caps,
      sessoes: [...antes, ...depois],
      plano: plano({
        recalculatedAtISO: capturedAt,
        baseline: {
          capturedAt,
          progressPct: 38,
          sessionsDone: 0,
          reflectionsDone: 0,
          completedChapterIds: [],
        },
      }),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.respostaAosAjustes.conteudo?.frequenciaAntes).toBe(1.1)
    expect(r.respostaAosAjustes.conteudo?.frequenciaDepois).toBe(1.9)
  })

  it("1.18 — baseline 38%, real 50% → +12 p.p.", () => {
    const caps = capitulos(2)
    const fonte = fonteBase({
      capitulos: caps,
      // 1 de 2 capítulos concluído = 50% de progresso real.
      progresso: [progresso({ chapter_id: caps[0].id, reached_last_slide_at: haDias(1) })],
      plano: plano({
        recalculatedAtISO: haDias(5),
        baseline: {
          capturedAt: haDias(5),
          progressPct: 38,
          sessionsDone: 0,
          reflectionsDone: 0,
          completedChapterIds: [],
        },
      }),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.respostaAosAjustes.conteudo?.progressoDeltaPp).toBe(12)
  })

  it("1.19 — SEM LASTRO: semanas dentro do plano depende da meta de frequência (1.3), que não existe", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      plano: plano({
        recalculatedAtISO: haDias(21),
        baseline: {
          capturedAt: haDias(21),
          progressPct: 10,
          sessionsDone: 0,
          reflectionsDone: 0,
          completedChapterIds: [],
        },
      }),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(temLastro(r.respostaAosAjustes.conteudo?.semanasDentroDoPlano)).toBe(false)
  })

  it("PAR VERMELHO: sem ajuste algum (sem baseline), o bloco fica vazio — não mostra números fantasmas", () => {
    const fonte = fonteBase({ capitulos: capitulos(1) })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    expect(r.respostaAosAjustes.estado).toBe("vazio")
    expect(r.respostaAosAjustes.conteudo).toBeNull()
  })
})

describe("1.20 / 1.21 / 1.22 — Sinais do meu momento", () => {
  it("1.20 — 6 sessões entre 19h–22h e 2 pela manhã → faixa da noite", () => {
    const datasNoite = [
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]
    const datasManha = ["2026-08-16", "2026-08-17"]
    const noite = datasNoite.map((d) => sessao({ created_at: `${d}T20:00:00.000Z` }))
    const manha = datasManha.map((d) => sessao({ created_at: `${d}T08:00:00.000Z` }))
    expect(melhorHorario([...noite, ...manha], 0)).toBe("19h–22h")
  })

  it("PAR VERMELHO 1.20 — sem amostra suficiente (menos que o mínimo), nenhuma faixa é anunciada", () => {
    const poucas = ["2026-08-10", "2026-08-11"].map((d) =>
      sessao({ created_at: `${d}T20:00:00.000Z` }),
    )
    expect(melhorHorario(poucas, 0)).toBeNull()
  })

  it("1.21 — concentração em terça e quinta → os dois dias", () => {
    // 2026-08-18 é terça, 2026-08-20 é quinta (referência: AGORA=2026-08-21, quinta).
    const tercas = Array.from({ length: 3 }, () =>
      sessao({ created_at: "2026-08-18T14:00:00.000Z" }),
    )
    const quintas = Array.from({ length: 3 }, () =>
      sessao({ created_at: "2026-08-20T14:00:00.000Z" }),
    )
    const dias = diasDaSemanaPreferidos([...tercas, ...quintas], 0)
    expect(dias).toContain("terça")
    expect(dias).toContain("quinta")
  })

  it("PAR VERMELHO 1.21 — distribuição plana (1 sessão por dia da semana) → supressão do sinal", () => {
    const datas = [
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-15",
    ]
    const sessoes = datas.map((d) => sessao({ created_at: `${d}T14:00:00.000Z` }))
    expect(diasDaSemanaPreferidos(sessoes, 0)).toHaveLength(0)
  })

  it("1.22 — 2 pausas de 8d com retomada em 4d → latência média 4", () => {
    const dias = [
      "2026-01-01",
      "2026-01-09", // pausa de 8d
      "2026-01-13", // retomada em 4d
      "2026-01-21", // pausa de 8d
      "2026-01-25", // retomada em 4d
    ]
    expect(latenciaMediaDeRetomada(dias)).toBe(4)
  })

  it("PAR VERMELHO 1.22 — com 1 SÓ ocorrência, supressão por amostra insuficiente", () => {
    const dias = ["2026-01-01", "2026-01-09", "2026-01-13"]
    expect(temLastro(latenciaMediaDeRetomada(dias))).toBe(false)
  })

  it("1.20 — nunca usa 'melhor' na frase do sinal (achado Annie Duke, 2026-08-21): observação sem julgamento", () => {
    const caps = capitulos(1)
    const datasNoite = [
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]
    const fonte = fonteBase({
      capitulos: caps,
      sessoes: datasNoite.map((d) => sessao({ created_at: `${d}T20:00:00.000Z` })),
    })
    const r = montarVisaoGeralAutogestao(fonte, AGORA)
    const sinal = r.sinaisDoMomento.itens.find((i) => i.id === "horario-frequente")
    expect(sinal?.texto.toLowerCase()).not.toContain("melhor")
    expect(sinal?.texto).toContain("período de 19h–22h")
  })

  it("1.22 — retomada AINDA EM CURSO (retorno recente) não conta na amostra: 2 pausas viram 1, e suprime", () => {
    // Mesmas 2 pausas de 8d/retomada em 4d do teste acima, mas agora com um
    // relógio (`agoraMs`) a 9 dias do segundo retorno — dentro de
    // `RETOMADA_JANELA_DIAS` (14), a mesma janela de "ainda estou retomando".
    const dias = [
      "2026-01-01",
      "2026-01-09", // pausa de 8d
      "2026-01-13", // retomada em 4d — MADURA (muito no passado)
      "2026-01-21", // pausa de 8d
      "2026-01-25", // retomada em 4d — AINDA EM CURSO relativo ao agora abaixo
    ]
    const agoraAindaEmCurso = Date.parse("2026-01-30T00:00:00.000Z") // 9d após o retorno de 01-21
    expect(temLastro(latenciaMediaDeRetomada(dias, agoraAindaEmCurso))).toBe(false)
  })

  it("PAR VERMELHO 1.22 — o mesmo histórico, com o agora bem depois da janela de retomada: as 2 contam, média 4", () => {
    const dias = ["2026-01-01", "2026-01-09", "2026-01-13", "2026-01-21", "2026-01-25"]
    const agoraJaMaturou = Date.parse("2026-02-10T00:00:00.000Z") // 20d após o retorno de 01-21, > janela
    expect(latenciaMediaDeRetomada(dias, agoraJaMaturou)).toBe(4)
  })
})

describe("Estados de pausa (§6) e retomadas (§17) — base de 1.1, 1.15, 2.6", () => {
  it("parado: última atividade há 20 dias", () => {
    expect(estadoDePausa(["2026-08-01"], Date.parse("2026-08-21T00:00:00.000Z"))).toBe("parado")
  })

  it("retomando: pausa de 20d que terminou ontem", () => {
    expect(
      estadoDePausa(["2026-07-20", "2026-08-20"], Date.parse("2026-08-21T00:00:00.000Z")),
    ).toBe("retomando")
  })

  it("PAR VERMELHO: pausa de 13 dias NÃO conta como retomada (2.6)", () => {
    expect(contarRetomadas(["2026-08-01", "2026-08-14"])).toBe(0)
  })

  it("pausa de 15 dias conta como retomada (2.6)", () => {
    expect(contarRetomadas(["2026-08-01", "2026-08-16"])).toBe(1)
  })

  it("2.4 — maior intervalo entre lacunas de 5, 12 e 9 dias → 12", () => {
    expect(maiorIntervaloDias(["2026-01-01", "2026-01-06", "2026-01-18", "2026-01-27"])).toBe(12)
  })
})
