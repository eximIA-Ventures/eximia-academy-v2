import type { StudentHomeIndicators } from "@/types/analytics"
import { describe, expect, it } from "vitest"
import { behindMetricsOf, buildRitmoSummary, summaryToneOf } from "../ritmo-summary"

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
    // SH-2.3 — este ramo só dispara quando summaryToneOf NÃO é "behind-*"; BASE
    // vence em tudo (tone "win"), então continua caindo aqui. Ver describe
    // "SH-2.3: abertura honesta quando o tom geral é atrás" para o caso em que
    // aboveAvgEngagement é true MAS o tom geral é atrás (o bug corrigido).
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

// ---------------------------------------------------------------------------
// ROUND 18 (Hugo 2026-07-18) — summaryToneOf: o tom GERAL que governa a ilustração do
// painel de resumo. Severity-first com override de #1. Pure + determinístico.
// ---------------------------------------------------------------------------
describe("summaryToneOf — tom geral do painel de resumo (Round 18)", () => {
  it("determinístico: mesma entrada, mesmo tom", () => {
    expect(summaryToneOf(BASE)).toBe(summaryToneOf(BASE))
  })

  it("#1 real (isTopEngagement) → 'win' (override celebratório), mesmo com algo atrás", () => {
    const topButBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, isTopEngagement: true, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(topButBehind)).toBe("win")
  })

  it("qualquer linha behind-severe domina → 'behind-severe'", () => {
    // Progresso 10 vs 90 (gap 89% > 30% → severe). Sem isTopEngagement.
    const severe: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(severe)).toBe("behind-severe")
  })

  it("behind-mild (sem severe) → 'behind-mild'", () => {
    // Interações 7 vs 8 (gap 12.5% → mild), resto à frente. Sem severe em nenhuma linha.
    const mild: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, interactions: 7 },
      reference: { ...BASE.reference, interactionsAvg: 8 },
    }
    expect(summaryToneOf(mild)).toBe("behind-mild")
  })

  it("à frente em algo, nada atrás → 'win' (o BASE vence tudo)", () => {
    expect(summaryToneOf(BASE)).toBe("win")
  })

  it("empate em tudo → 'tie'", () => {
    // Todos os pares Você == Turma (empate real em cada linha comparável).
    const allTie: StudentHomeIndicators = {
      subject: {
        lastAccessDays: 5,
        progressPct: 50,
        engagement: 40,
        interactions: 5,
        reflections: 30,
      },
      reference: {
        lastAccessAvgDays: 5,
        ritmoEmDiaPct: 40,
        progressAvgPct: 50,
        engagementAvg: 40,
        interactionsAvg: 5,
        reflectionsAvg: 30,
      },
    }
    expect(summaryToneOf(allTie)).toBe("tie")
  })

  it("sem dado comparável (1º acesso / valores ausentes) → 'none'", () => {
    // Todos os valores do sujeito null → nenhuma leitura possível → none em todas as linhas.
    const noData: StudentHomeIndicators = {
      subject: {
        lastAccessDays: null,
        progressPct: null as unknown as number,
        engagement: null as unknown as number,
        interactions: null as unknown as number,
        reflections: null as unknown as number,
      },
      reference: {
        lastAccessAvgDays: null,
        ritmoEmDiaPct: 40,
        progressAvgPct: null as unknown as number,
        engagementAvg: null as unknown as number,
        interactionsAvg: null as unknown as number,
        reflectionsAvg: null as unknown as number,
      },
    }
    expect(summaryToneOf(noData)).toBe("none")
  })
})

// ---------------------------------------------------------------------------
// SH-2.3 (Hugo 2026-07-19, achado do Espelho) — a abertura de `buildRitmoSummary`
// decidia elogiar SÓ a partir de `aboveAvgEngagement` (1 dos 5 indicadores), em vez
// de `summaryToneOf` (que já olha os 5 com a hierarquia de severidade certa e já
// governa o ícone do painel). Um aluno podia estar acima da média em engajamento e
// MUITO atrás no resto, e ainda ler um elogio isolado e desonesto. A abertura passa
// a consumir `summaryToneOf` como critério PRIMÁRIO (depois do override real de #1).
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.3: abertura honesta quando o tom geral é atrás", () => {
  it("engajamento acima da média MAS tom geral behind-severe → NÃO elogia engajamento isolado, abre honesto (o bug que o Espelho achou)", () => {
    // Engajamento à frente (80 > 40, aboveAvgEngagement=true, igual ao BASE), mas
    // progresso SEVERAMENTE atrás (10 vs 90, gap 89% > 30% → behind-severe domina).
    const engagementUpButOverallSevere: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(engagementUpButOverallSevere)).toBe("behind-severe")
    const out = buildRitmoSummary(engagementUpButOverallSevere, "Angelo")
    // O BUG antigo: isto teria disparado "seu engajamento está acima da média da
    // turma" só porque engagement(80) > engagementAvg(40), ignorando o atraso severo.
    expect(out).not.toContain("engajamento está acima da média")
    expect(out).not.toContain("mais engajado da turma")
    expect(out).toContain("hora de retomar o seu ritmo de estudos")
    expect(out.startsWith("Angelo, hora de retomar")).toBe(true)
    // Nunca "Parabéns" logo antes de um convite honesto de retomada.
    expect(out).not.toContain("Parabéns")
  })

  it("tom behind-mild (sem severe) → convite mais leve, também não elogia engajamento isolado", () => {
    const mildButAboveEngagement: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, interactions: 7 },
      reference: { ...BASE.reference, interactionsAvg: 8 },
    }
    expect(summaryToneOf(mildButAboveEngagement)).toBe("behind-mild")
    const out = buildRitmoSummary(mildButAboveEngagement, "Angelo")
    expect(out).not.toContain("engajamento está acima da média")
    expect(out).toContain("um lembrete gentil para retomar o seu ritmo de estudos")
    expect(out.startsWith("Angelo, um lembrete gentil")).toBe(true)
  })

  it("#1 real (isTopEngagement) SEMPRE vence o tom geral, mesmo com algo severamente atrás (override intocado)", () => {
    const topButSevere: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, isTopEngagement: true, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(topButSevere, "Angelo")
    expect(out).toContain("Parabéns Angelo, você é o aluno mais engajado da turma")
  })

  it("sem nome, tom behind-severe → abertura sem vocativo, sem 'Parabéns' e sem vírgula solta", () => {
    const severeNoName: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(severeNoName)
    expect(out.startsWith("hora de retomar o seu ritmo de estudos")).toBe(true)
    expect(out).not.toContain("Parabéns")
  })
})

// ---------------------------------------------------------------------------
// SH-2.3 — caso Angelo (Hugo, screenshot real): 0% progresso, 0/8 interações,
// 1/41 reflexões, 28º de 45 no engajamento. Com o dado JÁ CORRIGIDO pela SH-2.2
// (lastAccessDays agora reflete só ESTUDO real — aqui modelado como `null`, "ainda
// sem sessão de estudo", em vez do `0`/"hoje" que o bug antigo produzia a partir de
// um login puro). Valida que `summaryToneOf` calcula behind-severe corretamente com
// esse dado corrigido (ele está atrás em progresso/interações/reflexões/engajamento
// de qualquer forma, então deve, independente do que a linha "Última atividade" diz).
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — caso Angelo (SH-2.3, dado corrigido pela SH-2.2)", () => {
  const angelo: StudentHomeIndicators = {
    subject: {
      lastAccessDays: null, // SH-2.2: nenhuma sessão/reflexão recente, não "hoje"
      progressPct: 0,
      engagement: 1, // interactions*2 + reflections = 0*2 + 1
      interactions: 0,
      reflections: 1,
      interactionsMax: 8,
      reflectionsMax: 41,
    },
    reference: {
      lastAccessAvgDays: 6,
      ritmoEmDiaPct: 55,
      progressAvgPct: 52,
      engagementAvg: 22,
      interactionsAvg: 4,
      reflectionsAvg: 18,
    },
  }

  it("summaryToneOf → behind-severe (progresso/interações/reflexões/engajamento severamente atrás, mesmo com lastAccessDays=null)", () => {
    expect(summaryToneOf(angelo)).toBe("behind-severe")
  })

  it("DEPOIS da correção (SH-2.2 dado + SH-2.3 abertura): 'hora de retomar o seu ritmo de estudos', nunca 'Parabéns' nem elogio de engajamento isolado", () => {
    const out = buildRitmoSummary(angelo, "Angelo")
    expect(out).toContain("hora de retomar o seu ritmo de estudos")
    expect(out).not.toContain("Parabéns")
    expect(out).not.toContain("acima da média da turma")
    expect(out).not.toContain("mais engajado da turma")
    // A cláusula de oportunidade continua dinâmica (SH-1.5/AC9 cenário C, intocada).
    expect(out).toContain("oportunidade de melhoria")
  })
})
