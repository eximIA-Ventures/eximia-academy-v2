import type { StudentHomeIndicators } from "@/types/analytics"
import { describe, expect, it } from "vitest"
import { behindMetricsOf, buildRitmoSummary } from "../ritmo-summary"

// Base: aluno acima da média em tudo (última atividade recente, progresso, interações,
// reflexões, engajamento). NÃO é #1 por padrão (isTopEngagement ausente). Cada cenário
// deriva daqui mudando SÓ o que importa para o AC9.
const BASE: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 3,
    ritmoDisplay: "no_ritmo",
    progressPct: 70,
    engagement: 80,
    interactions: 7,
    reflections: 41,
    interactionsMax: 10,
    reflectionsMax: 50,
  },
  reference: {
    lastAccessAvgDays: 42,
    ritmoEmDiaPct: 40,
    progressAvgPct: 50,
    engagementAvg: 40,
    interactionsAvg: 5,
    reflectionsAvg: 30,
  },
}

describe("buildRitmoSummary — função pura e determinística (AC8)", () => {
  it("mesma entrada sempre produz a mesma saída (sem RNG, sem I/O)", () => {
    const a = buildRitmoSummary(BASE, "Caio")
    const b = buildRitmoSummary(BASE, "Caio")
    expect(a).toBe(b)
    expect(typeof a).toBe("string")
    expect(a.length).toBeGreaterThan(0)
  })

  it("sem nome → abertura sem o primeiro nome (não quebra)", () => {
    // A função PURA não envolve em aspas (as aspas vivem no JSX do card).
    const out = buildRitmoSummary(BASE)
    expect(out.startsWith("Parabéns, ")).toBe(true)
    expect(out).not.toContain("Parabéns , ")
  })

  it("copy nova sem travessão em dash (—) — regra da casa", () => {
    const out = buildRitmoSummary(BASE, "Caio")
    expect(out).not.toContain("—")
  })
})

describe("buildRitmoSummary — AC9 cenário A (aluno #1 real)", () => {
  it("rank real #1 (isTopEngagement true) → abertura 'você é o aluno mais engajado da turma'", () => {
    const top: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, isTopEngagement: true },
    }
    const out = buildRitmoSummary(top, "Caio")
    expect(out).toContain("Parabéns Caio")
    expect(out).toContain("você é o aluno mais engajado da turma")
  })
})

describe("buildRitmoSummary — AC9 cenário B (acima da média mas NÃO #1)", () => {
  it("engagement > engagementAvg mas rank ≠ 1 → NÃO 'mais engajado', NÃO '1º da turma'", () => {
    // BASE já é este caso: engagement 80 > 40, isTopEngagement ausente.
    const out = buildRitmoSummary(BASE, "Caio")
    expect(out).not.toContain("mais engajado da turma")
    expect(out).not.toContain("1º da turma")
    // usa a abertura alternativa que reconhece o acima-da-média sem alegar 1º lugar.
    expect(out).toContain("seu engajamento está acima da média da turma")
  })
})

describe("buildRitmoSummary — AC9 cenário C (abaixo em alguma métrica → oportunidade dinâmica)", () => {
  it("atrás em progresso e atividade → oportunidade aponta ESSAS métricas, não 'reflexões e interações' fixas", () => {
    // Aluno atrás em progresso (30 < 50) e em atividade recente (60 dias > 42),
    // mas à frente em interações/reflexões/engajamento.
    const behindProgress: StudentHomeIndicators = {
      ...BASE,
      subject: {
        ...BASE.subject,
        progressPct: 30,
        lastAccessDays: 60,
        // segue à frente no resto:
        interactions: 9,
        reflections: 45,
        engagement: 90,
      },
    }
    const out = buildRitmoSummary(behindProgress, "Caio")
    expect(out).toContain("oportunidade de melhoria")
    expect(out).toContain("progresso")
    expect(out).toContain("atividade recente")
    // NÃO menciona métricas onde o aluno está à frente.
    expect(out).not.toContain("interações")
    expect(out).not.toContain("reflexões")
  })

  it("atrás SÓ em reflexões → oportunidade aponta reflexões (dinâmico, não hardcoded)", () => {
    const behindReflections: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, reflections: 10 }, // 10 < média 30 → atrás
    }
    const out = buildRitmoSummary(behindReflections, "Caio")
    expect(out).toContain("reflexões")
    expect(out).not.toContain("progresso")
  })

  it("à frente ou empate em TODAS as métricas → fecho positivo, sem inventar ponto fraco", () => {
    const out = buildRitmoSummary(BASE, "Caio")
    // BASE vence em tudo → sem "oportunidade de melhoria".
    expect(out).not.toContain("oportunidade de melhoria")
    expect(out).toContain("à frente da turma")
  })
})

describe("behindMetricsOf — só as métricas realmente atrás (winnerOf === reference)", () => {
  it("BASE (à frente em tudo) → nenhuma métrica atrás", () => {
    expect(behindMetricsOf(BASE)).toEqual([])
  })

  it("atrás em progresso, interações e atividade recente → só essas, na ordem estável", () => {
    const behind: StudentHomeIndicators = {
      ...BASE,
      subject: {
        ...BASE.subject,
        progressPct: 20, // < 50 → atrás
        interactions: 2, // < 5 → atrás
        lastAccessDays: 90, // > 42 (dias, menor é melhor) → atrás
        // reflexões/engajamento seguem à frente.
      },
    }
    // Ordem estável: progresso, interações, engajamento?, atividade recente.
    // Aqui: progresso, interações e atividade recente (engajamento pode cair ao
    // baixar interações: 2*2+41=45 > 40, ainda à frente).
    expect(behindMetricsOf(behind)).toEqual(["progresso", "interações", "atividade recente"])
  })

  it("valor null em um lado → não conta como 'atrás' (sem leitura possível)", () => {
    const nullRecency: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, lastAccessDays: null },
    }
    expect(behindMetricsOf(nullRecency)).not.toContain("atividade recente")
  })
})
