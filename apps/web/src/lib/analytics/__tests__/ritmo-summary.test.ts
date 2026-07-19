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

  it("qualquer linha behind domina → 'behind' (SH-2.5: sem mais mild/severe)", () => {
    // Progresso 10 vs 90 (gap 89%, MUITO fora da faixa de 5% de tolerância). Sem isTopEngagement.
    const severe: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(severe)).toBe("behind")
  })

  it("gap moderado (12.5%) também vira 'behind' direto — não existe mais grau intermediário fora da faixa de 5%", () => {
    // Interações 7 vs 8 (gap 12.5%, fora da faixa de tolerância de 5% → behind, sem gradiente).
    const mild: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, interactions: 7 },
      reference: { ...BASE.reference, interactionsAvg: 8 },
    }
    expect(summaryToneOf(mild)).toBe("behind")
  })

  it("à frente em algo, nada atrás → 'win' (o BASE vence tudo)", () => {
    expect(summaryToneOf(BASE)).toBe("win")
  })

  it("empate em tudo → 'tie'", () => {
    // SH-2.5 (item 3) — "Última sessão de estudo" não compara mais com a Turma; usa
    // faixa absoluta (`recencyReadingFor`). 15 dias cai na faixa intermediária (8-30,
    // RECENCY_THRESHOLDS) → tone "tie", coerente com o resto empatado. Com o antigo
    // "5 vs 5" essa linha isolada já dava "win" (recente, <=7 dias), quebrando o "tudo
    // empatado" que este teste quer provar.
    const allTie: StudentHomeIndicators = {
      subject: {
        lastAccessDays: 15,
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
// de `summaryToneOf` (que já olha os 5 com a hierarquia certa e já governa o ícone
// do painel). Um aluno podia estar acima da média em engajamento e MUITO atrás no
// resto, e ainda ler um elogio isolado e desonesto. A abertura consome
// `summaryToneOf` como critério PRIMÁRIO (depois do override real de #1).
// SH-2.5 (Hugo 2026-07-19, feedback ao vivo) — item 1 eliminou mild/severe (agora
// só existe "behind"); item 2 trocou a copy suavizada por uma direta: "nao tem
// dessa de 'um lembrete gentil' tem que ser direto ao ponto". As duas fixtures
// abaixo (gap de 89% e gap de 12,5%) agora produzem o MESMO tom "behind" e a MESMA
// copy — prova de que a severidade deixou de diferenciar a mensagem.
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.5: abertura DIRETA quando o tom geral é atrás", () => {
  it("engajamento acima da média MAS tom geral behind (gap grande, 89%) → NÃO elogia engajamento isolado, abre direto (o bug que o Espelho achou)", () => {
    // Engajamento à frente (80 > 40, aboveAvgEngagement=true, igual ao BASE), mas
    // progresso MUITO atrás (10 vs 90, gap 89%, bem fora da faixa de 5%).
    const engagementUpButOverallBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(engagementUpButOverallBehind)).toBe("behind")
    const out = buildRitmoSummary(engagementUpButOverallBehind, "Angelo")
    // O BUG antigo: isto teria disparado "seu engajamento está acima da média da
    // turma" só porque engagement(80) > engagementAvg(40), ignorando o atraso.
    expect(out).not.toContain("engajamento está acima da média")
    expect(out).not.toContain("mais engajado da turma")
    // SH-2.5 (Hugo): "para retomar o seu ritmo de estudos", direto, sem suavização.
    expect(out).toContain("para retomar o seu ritmo de estudos")
    expect(out.startsWith("Angelo, para retomar")).toBe(true)
    // Nunca "Parabéns" logo antes de um convite de retomada.
    expect(out).not.toContain("Parabéns")
  })

  it("gap moderado (12,5%, fora da faixa de 5%) produz a MESMA abertura direta — sem grau intermediário na copy", () => {
    const moderateButAboveEngagement: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, interactions: 7 },
      reference: { ...BASE.reference, interactionsAvg: 8 },
    }
    expect(summaryToneOf(moderateButAboveEngagement)).toBe("behind")
    const out = buildRitmoSummary(moderateButAboveEngagement, "Angelo")
    expect(out).not.toContain("engajamento está acima da média")
    expect(out).toContain("para retomar o seu ritmo de estudos")
    expect(out.startsWith("Angelo, para retomar")).toBe(true)
    // Copy antiga ("lembrete gentil"/"hora de retomar") não existe mais.
    expect(out).not.toContain("lembrete gentil")
    expect(out).not.toContain("hora de retomar")
  })

  it("#1 real (isTopEngagement) SEMPRE vence o tom geral, mesmo com algo muito atrás (override intocado)", () => {
    const topButBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, isTopEngagement: true, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(topButBehind, "Angelo")
    expect(out).toContain("Parabéns Angelo, você é o aluno mais engajado da turma")
  })

  it("sem nome, tom behind → abertura sem vocativo, sem 'Parabéns' e sem vírgula solta", () => {
    const behindNoName: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(behindNoName)
    expect(out.startsWith("para retomar o seu ritmo de estudos")).toBe(true)
    expect(out).not.toContain("Parabéns")
  })
})

// ---------------------------------------------------------------------------
// SH-2.3 — caso Angelo (Hugo, screenshot real): 0% progresso, 0/8 interações,
// 1/41 reflexões, 28º de 45 no engajamento. Com o dado JÁ CORRIGIDO pela SH-2.2
// (lastAccessDays agora reflete só ESTUDO real — aqui modelado como `null`, "ainda
// sem sessão de estudo", em vez do `0`/"hoje" que o bug antigo produzia a partir de
// um login puro). Valida que `summaryToneOf` calcula "behind" corretamente com esse
// dado corrigido (ele está atrás em progresso/interações/reflexões/engajamento de
// qualquer forma, então deve, independente do que a linha "Última sessão de
// estudo" diz — que sob SH-2.5/item 3 nem entra mais nessa comparação).
// SH-2.5 — abertura atualizada para a copy direta do item 2 ("para retomar...").
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — caso Angelo (SH-2.3 dado + SH-2.5 abertura)", () => {
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

  it("summaryToneOf → behind (progresso/interações/reflexões/engajamento fora da faixa de 5%, mesmo com lastAccessDays=null)", () => {
    expect(summaryToneOf(angelo)).toBe("behind")
  })

  it("DEPOIS das correções (SH-2.2 dado + SH-2.5 abertura direta): 'para retomar o seu ritmo de estudos', nunca 'Parabéns' nem elogio de engajamento isolado", () => {
    const out = buildRitmoSummary(angelo, "Angelo")
    expect(out).toContain("para retomar o seu ritmo de estudos")
    expect(out).not.toContain("Parabéns")
    expect(out).not.toContain("acima da média da turma")
    expect(out).not.toContain("mais engajado da turma")
    // A cláusula de oportunidade continua dinâmica (SH-1.5/AC9 cenário C, intocada).
    expect(out).toContain("oportunidade de melhoria")
  })
})
