// ---------------------------------------------------------------------------
// Tela 2 — Meus Padrões e Tendências. Um teste por linha do contrato (2.1–2.8).
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest"
import { bucketizarSemanas } from "../../padroes-tendencias/semanas"
import {
  classificarTendencia,
  contarRetomadas,
  maiorIntervaloDias,
  montarPadroesAutogestao,
  regularidadeVezesPorSemana,
  rotuloFrequenciaMedia,
  rotuloVezesPorSemana,
  sequenciaAtualSemanas,
  serieSemanalDiasAtivos,
} from "../montagem"
import type { PontoRegularidade } from "../tipos"
import { temLastro } from "../tipos"
import { AGORA, AGORA_MS, capitulos, diaChave, fonteBase, haDias, sessao } from "./fixture"

describe("2.1 — Série semanal (dias ativos por semana)", () => {
  it("12 semanas com valores CONHECIDOS → os 12 pontos, na ordem, com os valores certos", () => {
    const baldes = bucketizarSemanas(AGORA_MS, 12)
    const carimbos: number[] = []
    const esperado: number[] = []
    for (const b of baldes) {
      const n = (b.indice % 4) + 1 // varia 1..4 — nunca constante
      esperado.push(n)
      for (let d = 0; d < n; d++) carimbos.push(b.inicioMs + d * 86_400_000)
    }
    const pontos = serieSemanalDiasAtivos(carimbos, AGORA_MS, 12)
    expect(pontos).toHaveLength(12)
    pontos.forEach((p, i) => {
      expect(p.indice).toBe(i)
      expect(p.diasAtivos).toBe(esperado[i])
    })
  })

  it("PAR VERMELHO: semana sem NENHUMA atividade fica com diasAtivos 0, não inventa presença", () => {
    const baldes = bucketizarSemanas(AGORA_MS, 3)
    const carimbos = [baldes[0].inicioMs, baldes[2].inicioMs] // semana do meio (índice 1) vazia
    const pontos = serieSemanalDiasAtivos(carimbos, AGORA_MS, 3)
    expect(pontos[1]?.diasAtivos).toBe(0)
  })
})

describe("2.2 — Meta do plano (linha tracejada): SEM LASTRO", () => {
  it("depende da mesma meta ausente de 1.3 — nunca uma linha inventada", () => {
    const fonte = fonteBase({
      capitulos: capitulos(1),
      sessoes: [sessao({ created_at: haDias(1) })],
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    expect(temLastro(r.serie.metaLinha)).toBe(false)
  })
})

describe("2.3 — Frequência média (idem 1.2)", () => {
  it("18 dias ativos em 10 semanas → 1,8 (fórmula pura)", () => {
    expect(regularidadeVezesPorSemana(18, 70)).toBe(1.8)
  })

  it("PAR VERMELHO (variância): 24 dias ativos em 12 semanas (90d) → 2,0, não 1,8 fixo", () => {
    expect(regularidadeVezesPorSemana(24, 84)).toBe(2)
  })

  it("integração: 18 dias ativos dentro de um filtro de 90 dias → 1,4x/semana", () => {
    // 18 / (90/7) = 18 / 12,857142857... = 1,4 exatamente (90*1.4/7 = 18).
    const dias = Array.from({ length: 18 }, (_, i) => haDias(1 + i * 4))
    const fonte = fonteBase({
      periodoDias: 90,
      capitulos: capitulos(1),
      sessoes: dias.map((d) => sessao({ created_at: d })),
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    expect(r.continuidade.conteudo?.frequenciaMedia).toBe(1.4)
  })

  it("rotuloFrequenciaMedia: com janela de 30 dias, usa 'Nx por semana' (várias semanas, 'média' é honesto)", () => {
    expect(rotuloFrequenciaMedia(4, 30)).toBe(
      rotuloVezesPorSemana(regularidadeVezesPorSemana(4, 30)),
    )
  })

  it("PAR VERMELHO rotuloFrequenciaMedia: com janela de 7 dias (1 única semana), NUNCA usa 'por semana' — vira contagem simples", () => {
    const rotulo = rotuloFrequenciaMedia(4, 7)
    expect(rotulo.toLowerCase()).not.toContain("por semana")
    expect(rotulo.toLowerCase()).not.toContain("média")
    expect(rotulo).toBe("4 dias ativos nesta semana")
  })

  it("integração: filtro de 7 dias não gera rótulo 'Nx por semana' na Tela 2 (§17, achado Annie Duke)", () => {
    const fonte = fonteBase({
      periodoDias: 7,
      capitulos: capitulos(1),
      sessoes: [1, 3, 5].map((n) => sessao({ created_at: haDias(n) })),
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    expect(r.continuidade.conteudo?.frequenciaRotulo.toLowerCase()).not.toContain("por semana")
    expect(r.continuidade.conteudo?.frequenciaRotulo).toBe("3 dias ativos nesta semana")
  })
})

describe("2.4 — Maior intervalo sem estudar", () => {
  it("lacunas de 5, 12 e 9 dias → 12", () => {
    expect(maiorIntervaloDias(["2026-01-01", "2026-01-06", "2026-01-18", "2026-01-27"])).toBe(12)
  })

  it("PAR VERMELHO (variância): lacunas de 3, 6 e 4 dias → 6, não 12 fixo", () => {
    expect(maiorIntervaloDias(["2026-01-01", "2026-01-04", "2026-01-10", "2026-01-14"])).toBe(6)
  })
})

describe("2.5 — Sequência atual (semanas consecutivas ativas)", () => {
  it("3 semanas ativas após 1 semana zerada (mais antiga) → 3", () => {
    const dias = [diaChave(2), diaChave(9), diaChave(16), diaChave(30)] // semana 4 (dias 21-28) fica zerada
    expect(sequenciaAtualSemanas(dias, AGORA_MS)).toBe(3)
  })

  it("PAR VERMELHO: zerar a semana CORRENTE → 0, mesmo com histórico mais antigo", () => {
    const dias = [diaChave(9), diaChave(16)] // nada nos últimos 7 dias
    expect(sequenciaAtualSemanas(dias, AGORA_MS)).toBe(0)
  })
})

describe("2.6 — Retomadas (retorno após ≥14 dias parado)", () => {
  it("pausa de 13 dias NÃO conta", () => {
    expect(contarRetomadas(["2026-08-01", "2026-08-14"])).toBe(0)
  })

  it("PAR VERMELHO: pausa de 15 dias CONTA → 1", () => {
    expect(contarRetomadas(["2026-08-01", "2026-08-16"])).toBe(1)
  })
})

describe("2.7 — O que favorece meu ritmo? (nunca causal)", () => {
  it("n ABAIXO do mínimo de semanas regulares → supressão (bloco vazio)", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      // só 2 semanas com ≥2 dias distintos (mínimo exigido é 3) e nenhuma pausa longa.
      sessoes: [
        sessao({ created_at: haDias(1) }),
        sessao({ created_at: haDias(3) }),
        sessao({ created_at: haDias(8) }),
        sessao({ created_at: haDias(10) }),
      ],
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    expect(r.favorece.estado).toBe("vazio")
    expect(r.favorece.itens).toHaveLength(0)
  })

  it("PAR VERMELHO: n ACIMA do mínimo (3 semanas regulares) → aparece, com 'nas semanas em que', nunca 'porque'", () => {
    const caps = capitulos(1)
    const fonte = fonteBase({
      capitulos: caps,
      sessoes: [
        sessao({ created_at: haDias(1) }),
        sessao({ created_at: haDias(3) }),
        sessao({ created_at: haDias(8) }),
        sessao({ created_at: haDias(10) }),
        sessao({ created_at: haDias(15) }),
        sessao({ created_at: haDias(17) }),
      ],
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    expect(r.favorece.estado).toBe("ok")
    const distribuicao = r.favorece.itens.find((i) => i.id === "distribuicao-de-dias")
    expect(distribuicao?.texto.toLowerCase()).toContain("nas semanas em que")
    for (const item of r.favorece.itens) {
      expect(item.texto.toLowerCase()).not.toContain("porque")
      expect(item.texto.toLowerCase()).not.toContain("isso causa")
    }
  })

  it("insight de pausas prolongadas usa 'observamos', nunca causalidade — e respeita o mínimo de ocorrências", () => {
    const caps = capitulos(1)
    const dias = [
      "2026-01-01",
      "2026-01-09", // pausa de 8d
      "2026-01-13", // retomada em 4d
      "2026-01-21", // pausa de 8d
      "2026-01-25", // retomada em 4d
    ]
    const fonte = fonteBase({
      capitulos: caps,
      sessoes: dias.map((d) => sessao({ created_at: `${d}T12:00:00.000Z` })),
    })
    const r = montarPadroesAutogestao(fonte, AGORA)
    const pausas = r.favorece.itens.find((i) => i.id === "pausas-prolongadas")
    expect(pausas?.texto).toContain("Observamos que")
    expect(pausas?.texto.toLowerCase()).not.toContain("porque")
  })
})

describe("2.8 — Tendência atual (4 estados possíveis)", () => {
  const ponto = (indice: number, diasAtivos: number): PontoRegularidade => ({
    indice,
    rotulo: `semana ${indice}`,
    inicioISO: "2026-01-01T00:00:00.000Z",
    fimISO: "2026-01-08T00:00:00.000Z",
    diasAtivos,
  })

  it("Sustentando: últimas 3 semanas todas com atividade", () => {
    const pontos = [ponto(0, 1), ponto(1, 2), ponto(2, 2), ponto(3, 2)]
    expect(classificarTendencia(pontos, null)).toBe("sustentando")
  })

  it("Desacelerando: atividade recente cai em relação à metade mais antiga da série", () => {
    const pontos = [ponto(0, 4), ponto(1, 4), ponto(2, 0), ponto(3, 0)]
    expect(classificarTendencia(pontos, null)).toBe("desacelerando")
  })

  it("Retomando: estado de pausa vence a leitura da série", () => {
    const pontos = [ponto(0, 1), ponto(1, 2), ponto(2, 2), ponto(3, 2)]
    expect(classificarTendencia(pontos, "retomando")).toBe("retomando")
  })

  it("Sem padrão suficiente: menos pontos que o mínimo de semanas", () => {
    expect(classificarTendencia([ponto(0, 1)], null)).toBe("sem-padrao-suficiente")
  })

  it("PAR VERMELHO: os 4 rótulos são DISTINTOS entre si", () => {
    const rotulos = new Set([
      classificarTendencia([ponto(0, 1), ponto(1, 2), ponto(2, 2), ponto(3, 2)], null),
      classificarTendencia([ponto(0, 4), ponto(1, 4), ponto(2, 0), ponto(3, 0)], null),
      classificarTendencia([ponto(0, 1), ponto(1, 2), ponto(2, 2), ponto(3, 2)], "retomando"),
      classificarTendencia([ponto(0, 1)], null),
    ])
    expect(rotulos.size).toBe(4)
  })
})
