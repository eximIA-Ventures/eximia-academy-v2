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

  // SH-2.6 (Hugo 2026-07-19, feedback ao vivo, caso Rinaldo) — "any behind
  // domina" (regra da SH-2.5) era grosseira demais: 1 linha vermelha isolada
  // entre 4 boas pintava o painel INTEIRO de vermelho. O Hugo: "se a gente
  // levar em consideração o Rinaldo está com 4 indicadores acima da média
  // enquanto um vermelho, então ele não pode estar com a frase embaixo
  // vermelho, ele tem que estar com a frase embaixo em âmbar." Agora o tom
  // geral é sensível à PROPORÇÃO: exatamente 1 linha behind → tie (âmbar);
  // 2 ou mais → behind (vermelho, `SUMMARY_TONE_BEHIND_COUNT_FOR_RED`).
  it("SH-2.6 — EXATAMENTE 1 linha behind (mesmo com gap grande, 89%) → 'tie' (âmbar), NÃO mais 'behind'", () => {
    // Progresso 10 vs 90 (gap 89%, MUITO fora da faixa de 5% de tolerância). Sem isTopEngagement.
    const oneBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(oneBehind)).toBe("tie")
  })

  it("SH-2.6 — 1 linha behind com gap moderado (12,5%) também vira 'tie' (o gap não muda a proporção)", () => {
    // Interações 7 vs 8 (gap 12.5%, fora da faixa de tolerância de 5%, mas é a ÚNICA
    // linha behind → tie, não behind).
    const oneBehindModerate: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, interactions: 7 },
      reference: { ...BASE.reference, interactionsAvg: 8 },
    }
    expect(summaryToneOf(oneBehindModerate)).toBe("tie")
  })

  it("SH-2.6 — 2 OU MAIS linhas behind → 'behind' (vermelho) domina, proporção real de atraso", () => {
    // Progresso 10 vs 90 E interações 2 vs 8 → 2 linhas behind → cruza
    // SUMMARY_TONE_BEHIND_COUNT_FOR_RED (2) → vermelho.
    const twoBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10, interactions: 2 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    expect(summaryToneOf(twoBehind)).toBe("behind")
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
// dessa de 'um lembrete gentil' tem que ser direto ao ponto".
// SH-2.6 (Hugo 2026-07-19, feedback ao vivo, caso Rinaldo) — `summaryToneOf`
// virou proporção-aware (ver describe acima): as fixtures de 1-linha-behind desta
// story NÃO produzem mais "behind" — produzem "tie". Os fixtures abaixo foram
// ajustados para 2+ linhas behind (mantendo a prova original do bug do Espelho),
// e um NOVO bloco cobre a mesma prova para o ramo "tie" (1 linha behind).
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.5/2.6: abertura DIRETA quando o tom geral é 'behind' (2+ linhas atrás)", () => {
  it("engajamento acima da média MAS tom geral behind (2 linhas atrás) → NÃO elogia engajamento isolado, abre direto (o bug que o Espelho achou)", () => {
    // Engajamento à frente (80 > 40, aboveAvgEngagement=true, igual ao BASE), mas
    // progresso E interações MUITO atrás → 2 linhas behind → tom geral "behind".
    const engagementUpButOverallBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10, interactions: 1 },
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

  it("#1 real (isTopEngagement) SEMPRE vence o tom geral, mesmo com múltiplas linhas atrás (override intocado)", () => {
    const topButBehind: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, isTopEngagement: true, progressPct: 10, interactions: 1 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(topButBehind, "Angelo")
    expect(out).toContain("Parabéns Angelo, você é o aluno mais engajado da turma")
  })

  it("sem nome, tom behind (2+ linhas) → abertura sem vocativo, sem 'Parabéns' e sem vírgula solta", () => {
    const behindNoName: StudentHomeIndicators = {
      ...BASE,
      subject: { ...BASE.subject, progressPct: 10, interactions: 1 },
      reference: { ...BASE.reference, progressAvgPct: 90 },
    }
    const out = buildRitmoSummary(behindNoName)
    expect(out.startsWith("para retomar o seu ritmo de estudos")).toBe(true)
    expect(out).not.toContain("Parabéns")
  })
})

// ---------------------------------------------------------------------------
// SH-2.6 (Hugo 2026-07-19, caso Rinaldo — validação explícita) — Progresso 50 vs
// 67 (Turma), as outras 4 linhas boas. O Hugo viu o painel abrir vermelho e
// rejeitou: "se a gente levar em consideração o Rinaldo está com 4 indicadores
// acima da média enquanto um vermelho, então ele não pode estar com a frase
// embaixo vermelho, ele tem que estar com a frase embaixo em âmbar." A abertura
// "tie" (1 linha behind) é honesta mas mais leve que "behind" — NUNCA "lembrete
// gentil"/"convite suave" (o Hugo já rejeitou esse tom no fix anterior, SH-2.5).
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.6: abertura ÂMBAR quando o tom geral é 'tie' (exatamente 1 linha atrás)", () => {
  const rinaldo: StudentHomeIndicators = {
    ...BASE,
    subject: { ...BASE.subject, progressPct: 50 }, // 4 linhas boas (herdadas do BASE) + progresso atrás
    reference: { ...BASE.reference, progressAvgPct: 67 }, // gap (50-67)/67 ≈ -25%, fora da faixa de 5%
  }

  it("summaryToneOf(Rinaldo) → 'tie' (âmbar), NÃO 'behind' (validação do caso real do Hugo)", () => {
    expect(summaryToneOf(rinaldo)).toBe("tie")
  })

  it("engajamento acima da média MAS tom geral tie (1 linha atrás) → NÃO elogia engajamento isolado, abre âmbar honesto (mesmo bug do Espelho, agora no ramo tie)", () => {
    const out = buildRitmoSummary(rinaldo, "Rinaldo")
    expect(out).not.toContain("engajamento está acima da média")
    expect(out).not.toContain("mais engajado da turma")
    // SH-2.7.2 (sucede a redação estática "seu ritmo está bom, com um ponto de
    // atenção" da SH-2.6) — abertura estruturada citando a métrica com o número
    // real. Só progresso está sinalizado aqui (única métrica), então só a 1ª
    // frase existe, sem a 2ª ("também pede atenção..."). 50/67*100 ≈ 74,6%; sem
    // freio aplicado (sem `expectedProgressPct` no fixture), a distância é "da
    // média da turma", não "do potencial".
    expect(out).toBe(
      "Rinaldo, seu ritmo geral está bom, mas hoje o ponto real de atenção é progresso: você está em apenas 74,6% da média da turma.",
    )
    expect(out.startsWith("Rinaldo, seu ritmo geral está bom")).toBe(true)
    expect(out).not.toContain("Parabéns")
    expect(out).not.toContain("lembrete gentil")
    expect(out).not.toContain("convite")
    // SH-2.7.2 — este ramo não usa mais a frase solta "oportunidade de melhoria";
    // a métrica e o número já vêm citados na abertura estruturada acima.
    expect(out).not.toContain("oportunidade de melhoria")
    expect(out).toContain("progresso")
  })

  it("um 'tie' GENUÍNO (0 linhas behind, ex.: tudo empatado) NÃO usa a copy de 'ponto de atenção' — cai no ramo neutro de sempre", () => {
    // Mesmo fixture de "empate em tudo" do describe summaryToneOf acima: 0 linhas
    // behind, tom "tie" só porque não há win nem behind — não é o caso Rinaldo.
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
    const out = buildRitmoSummary(allTie, "Caio")
    expect(out).not.toContain("ponto de atenção")
    expect(out).toContain("Parabéns Caio, bom te ver de volta ao seu ritmo de estudos")
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

// ---------------------------------------------------------------------------
// SH-2.7.1 (Hugo 2026-07-20, achado ao vivo, caso real Rinaldo) — no screenshot
// do Hugo, o painel dizia "Sua oportunidade de melhoria é evoluir em progresso"
// — mas a linha de fato sinalizada pelo freio (âmbar, SH-2.7) era Reflexões, não
// Progresso. Bug: `behindMetricsOf` olhava só `winnerOf` CRU (pré-freio) —
// Reflexões (8/41, vencia a Turma 4/41 no relativo) nunca entrava na lista,
// porque o freio a rebaixa de win para tie SÓ na tabela, não em `behindMetricsOf`.
// Corrigido para considerar o resultado FINAL (pós-freio); a frase de reflexões
// ganhou a mesma linguagem quantificada do chip (item 1). Progresso continua
// citado SEM número — ele está genuinamente atrás da Turma (50 vs 67), não
// capped pelo freio, então não tem `actualPct` de trilha para citar.
// ---------------------------------------------------------------------------
describe("behindMetricsOf/buildRitmoSummary — SH-2.7.1, caso real Rinaldo (Reflexões capped pelo freio)", () => {
  const rinaldo: StudentHomeIndicators = {
    subject: {
      lastAccessDays: 1,
      progressPct: 50,
      engagement: 22,
      interactions: 7,
      reflections: 8,
      interactionsMax: 8,
      reflectionsMax: 41,
      // Dado real (Supabase, tenant CORY, 2026-07-19): elapsedDays≈58,7/deadlineDays=180.
      expectedProgressPct: 33,
    },
    reference: {
      lastAccessAvgDays: 5,
      ritmoEmDiaPct: 50,
      progressAvgPct: 67,
      engagementAvg: 12,
      interactionsAvg: 5,
      reflectionsAvg: 4,
    },
  }

  it("behindMetricsOf cita 'reflexões' (capped pelo freio) JUNTO com 'progresso' (genuinamente atrás) — não mais só progresso", () => {
    expect(behindMetricsOf(rinaldo)).toEqual(["progresso", "reflexões"])
  })

  // SH-2.7.2 (Hugo 2026-07-20) substituiu a frase de oportunidade genérica
  // ("Sua oportunidade de melhoria é evoluir em progresso e reflexões (você
  // está em 19,5% do potencial)" — que amarrava o % da reflexão como se
  // valesse também para o progresso) pela abertura estruturada abaixo, que dá
  // a CADA métrica o próprio número. Ver describe "SH-2.7.2" logo adiante para
  // a validação completa (frase exata + regras de 1 vs 2+ métricas).

  it("summaryToneOf(Rinaldo) → 'tie' (só progresso é 'behind' de verdade; reflexões capped é 'tie', não soma à proporção de vermelho da SH-2.6)", () => {
    expect(summaryToneOf(rinaldo)).toBe("tie")
  })

  it("abertura do painel usa o ramo 'tie com ponto de atenção' (SH-2.6/2.7.2), não 'behind' nem elogio de engajamento isolado", () => {
    const out = buildRitmoSummary(rinaldo, "Rinaldo")
    expect(out).toContain("o ponto real de atenção é reflexões")
    expect(out).not.toContain("para retomar o seu ritmo de estudos")
    expect(out).not.toContain("engajamento está acima da média")
  })
})

// ---------------------------------------------------------------------------
// SH-2.7.2 (Hugo 2026-07-20, "última rodada de copy", aprovada pelo Hugo) — a
// abertura tie-com-ponto-de-atenção deixou de amarrar UM número solto a uma
// lista de várias métricas ("evoluir em progresso e reflexões (você está em
// 19,5% do potencial)" — o 19,5% era só da reflexão, citado como se valesse
// para o progresso também). Cada métrica sinalizada agora ganha o PRÓPRIO
// número: a MAIS crítica (maior distância do potencial/da Turma) na 1ª frase,
// a(s) restante(s) na 2ª frase citando o texto que o chip "Como estou" daquela
// linha já mostra (reuso, não invenção). Validação MANDATÓRIA contra o caso
// REAL do Rinaldo (mesmo fixture da SH-2.7.1: reflexões 8/41≈19,5% capped pelo
// freio, progresso 50 vs 67 genuinamente atrás) — reflexões é a mais crítica
// (achievementPct≈19,5 < achievementPct progresso≈74,6), então entra na 1ª
// frase; progresso entra na 2ª citando "1 sessão te recoloca no ritmo"
// (LEITURA_COPY.progress.behind, comparison-insights-table.tsx), o MESMO texto
// que o chip da linha Progresso já mostra na tabela.
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.7.2: abertura tie separa cada métrica com o próprio número, caso real Rinaldo", () => {
  const rinaldo: StudentHomeIndicators = {
    subject: {
      lastAccessDays: 1,
      progressPct: 50,
      engagement: 22,
      interactions: 7,
      reflections: 8,
      interactionsMax: 8,
      reflectionsMax: 41,
      expectedProgressPct: 33,
    },
    reference: {
      lastAccessAvgDays: 5,
      ritmoEmDiaPct: 50,
      progressAvgPct: 67,
      engagementAvg: 12,
      interactionsAvg: 5,
      reflectionsAvg: 4,
    },
  }

  it("caso real Rinaldo (2 métricas sinalizadas) → frase exata: reflexões (mais crítica, capped) na 1ª frase, progresso (genuinamente atrás) na 2ª reusando a copy do chip", () => {
    const out = buildRitmoSummary(rinaldo, "Rinaldo")
    expect(out).toBe(
      "Rinaldo, seu ritmo geral está bom, mas hoje o ponto real de atenção é reflexões: você está em apenas 19,5% do potencial. Progresso também pede atenção, 1 sessão te recoloca no ritmo.",
    )
  })

  it("só 1 métrica sinalizada → só a 1ª frase, sem a 2ª ('também pede atenção')", () => {
    // Mesmo fixture, mas reflexões sobe para dentro do próprio ritmo esperado
    // (33/41 ≈ 80,5% >= 33% esperado) — só progresso continua atrás.
    const soProgresso: StudentHomeIndicators = {
      ...rinaldo,
      subject: { ...rinaldo.subject, reflections: 33 },
    }
    const out = buildRitmoSummary(soProgresso, "Rinaldo")
    expect(out.endsWith("do potencial.") || out.endsWith("da média da turma.")).toBe(true)
    expect(out).not.toContain("também pede")
    expect(out).not.toContain("também pedem")
  })

  it("sem travessão (—) — regra da casa, também neste ramo", () => {
    const out = buildRitmoSummary(rinaldo, "Rinaldo")
    expect(out).not.toContain("—")
  })

  it("a cláusula 'você se mantém ativo com atividades recentes' foi removida do painel inteiro (não só do tie)", () => {
    expect(buildRitmoSummary(rinaldo, "Rinaldo")).not.toContain("atividades recentes")
  })
})

// ---------------------------------------------------------------------------
// SH-2.8 (Hugo 2026-07-20, caso real Angelo, feedback ao vivo) — Angelo estudou
// de verdade no dia (Progresso 0%→50%, 4 sessões numa rajada de 1h25), mas
// Interações ficou em 4/8 (atrás da Turma, 7/8 — dado dado explicitamente pelo
// Hugo) e Reflexões em 1/41 (quase zero, apesar de meia trilha percorrida). O
// Hugo viu a frase genérica "Angelo, para retomar o seu ritmo de estudos. Sua
// oportunidade de melhoria é evoluir em progresso, interações, reflexões e
// engajamento." e pediu "mais um cutucão": o ponto diagnóstico específico
// ("fez a aula, não fez a parte que importa") em vez da lista neutra de 4
// métricas. NOTA: os valores de Turma para progresso/reflexões/engajamento
// abaixo são ILUSTRATIVOS (escolhidos para reproduzir o tom geral "behind" já
// visível na frase que o Hugo colou, com as 4 métricas sinalizadas) — só o
// valor de Interações da Turma (7/8) veio citado explicitamente pelo Hugo
// nesta rodada; os demais não foram consultados no Supabase desta vez (ao
// contrário do caso Rinaldo, SH-2.7).
// ---------------------------------------------------------------------------
describe("buildRitmoSummary — SH-2.8: 'engajamento superficial' dentro do ramo behind, caso real Angelo", () => {
  const angelo: StudentHomeIndicators = {
    subject: {
      lastAccessDays: 0, // rajada de estudo HOJE (1h25, 4 sessões)
      progressPct: 50, // 0% → 50% no dia
      engagement: 9, // 4*2 + 1
      interactions: 4,
      reflections: 1,
      interactionsMax: 8,
      reflectionsMax: 41,
    },
    reference: {
      lastAccessAvgDays: 5,
      ritmoEmDiaPct: 50,
      progressAvgPct: 65,
      engagementAvg: 20,
      interactionsAvg: 7, // dado explícito do Hugo: "atrás da Turma, 7/8"
      reflectionsAvg: 15,
    },
  }

  it("summaryToneOf(Angelo) → 'behind' (4 linhas atrás: progresso/interações/reflexões/engajamento)", () => {
    expect(summaryToneOf(angelo)).toBe("behind")
  })

  it("frase final EXATA: faz o ponto sobre reflexões (não interações — 4/8 moveu junto com o progresso, sem disparidade)", () => {
    const out = buildRitmoSummary(angelo, "Angelo")
    expect(out).toBe(
      "Angelo, você avançou no conteúdo, mas quase não refletiu: sem isso, o progresso conta menos do que parece.",
    )
  })

  it("NÃO usa mais a abertura genérica nem a lista neutra de 4 métricas para este caso", () => {
    const out = buildRitmoSummary(angelo, "Angelo")
    expect(out).not.toContain("para retomar o seu ritmo de estudos")
    expect(out).not.toContain("oportunidade de melhoria")
  })

  it("sem travessão (—) — regra da casa, também neste ramo novo", () => {
    expect(buildRitmoSummary(angelo, "Angelo")).not.toContain("—")
  })

  it("Interações NÃO dispara sozinha: 4/8=50% contra Progresso 50% é a MESMA proporção, sem disparidade", () => {
    // Prova direta de que o sinal não é "toda métrica atrás dispara" — só quando
    // desproporcional ao PRÓPRIO progresso (SH-2.7.1/2.7.2 já cobrem "atrás da
    // Turma" via `behindMetricsOf`, que continua citando interações).
    expect(behindMetricsOf(angelo)).toContain("interações")
    expect(buildRitmoSummary(angelo, "Angelo")).not.toContain("interagiu")
  })

  it("genericidade: quando é INTERAÇÕES (não reflexões) que fica desproporcional ao progresso, o ponto cita interações", () => {
    // Progresso 60%; interações 1/10=10% (gap 50, dispara); reflexões 25/40=62,5%
    // (gap -2,5, não dispara — ficou até ACIMA do progresso). Turma: progresso
    // 70 (behind) e interações 6 (behind) já bastam para tone "behind" (2 linhas).
    const interacoesSuperficiais: StudentHomeIndicators = {
      subject: {
        lastAccessDays: 0,
        progressPct: 60,
        engagement: 1 * 2 + 25,
        interactions: 1,
        reflections: 25,
        interactionsMax: 10,
        reflectionsMax: 40,
      },
      reference: {
        lastAccessAvgDays: 5,
        ritmoEmDiaPct: 50,
        progressAvgPct: 70,
        engagementAvg: 15,
        interactionsAvg: 6,
        reflectionsAvg: 20,
      },
    }
    expect(summaryToneOf(interacoesSuperficiais)).toBe("behind")
    const out = buildRitmoSummary(interacoesSuperficiais, "Bia")
    expect(out).toBe(
      "Bia, você avançou no conteúdo, mas quase não interagiu: sem isso, o progresso conta menos do que parece.",
    )
  })

  it("genericidade: as DUAS métricas desproporcionais → 'interagiu nem refletiu' (ordem estável)", () => {
    const ambasSuperficiais: StudentHomeIndicators = {
      subject: {
        lastAccessDays: 0,
        progressPct: 70,
        engagement: 1 * 2 + 2,
        interactions: 1,
        reflections: 2,
        interactionsMax: 10,
        reflectionsMax: 40,
      },
      reference: {
        lastAccessAvgDays: 5,
        ritmoEmDiaPct: 50,
        progressAvgPct: 85,
        engagementAvg: 15,
        interactionsAvg: 6,
        reflectionsAvg: 20,
      },
    }
    expect(summaryToneOf(ambasSuperficiais)).toBe("behind")
    const out = buildRitmoSummary(ambasSuperficiais, "Caio")
    expect(out).toBe(
      "Caio, você avançou no conteúdo, mas quase não interagiu nem refletiu: sem isso, o progresso conta menos do que parece.",
    )
  })

  it("regressão: progresso perto de zero (caso Angelo ORIGINAL, SH-2.3) NÃO dispara o sinal novo — 'avançou no conteúdo' seria falso", () => {
    // Mesmo fixture do describe "caso Angelo (SH-2.3 dado + SH-2.5 abertura)"
    // acima: progressPct 0 < minProgressPct (20) → superficialGap sempre false,
    // continua caindo na abertura genérica "para retomar o seu ritmo de estudos".
    const angeloOriginal: StudentHomeIndicators = {
      subject: {
        lastAccessDays: null,
        progressPct: 0,
        engagement: 1,
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
    const out = buildRitmoSummary(angeloOriginal, "Angelo")
    expect(out).toContain("para retomar o seu ritmo de estudos")
    expect(out).not.toContain("você avançou no conteúdo")
  })

  it("regressão: tom behind SEM disparidade (todas as métricas fracionárias acompanham o progresso na mesma proporção) → mantém a abertura genérica + oportunidade", () => {
    // Progresso 40%; interações 4/10=40% (gap 0); reflexões 16/40=40% (gap 0) —
    // nenhuma desproporcional ao próprio progresso, mesmo com tom geral "behind"
    // (progresso e interações atrás da Turma).
    const semDisparidade: StudentHomeIndicators = {
      subject: {
        lastAccessDays: 0,
        progressPct: 40,
        engagement: 4 * 2 + 16,
        interactions: 4,
        reflections: 16,
        interactionsMax: 10,
        reflectionsMax: 40,
      },
      reference: {
        lastAccessAvgDays: 5,
        ritmoEmDiaPct: 50,
        progressAvgPct: 60,
        engagementAvg: 30,
        interactionsAvg: 8,
        reflectionsAvg: 30,
      },
    }
    expect(summaryToneOf(semDisparidade)).toBe("behind")
    const out = buildRitmoSummary(semDisparidade, "Davi")
    expect(out).toContain("para retomar o seu ritmo de estudos")
    expect(out).toContain("oportunidade de melhoria")
    expect(out).not.toContain("você avançou no conteúdo")
  })
})

// ---------------------------------------------------------------------------
// C — feat-percorrido-na-tela-do-aluno (Hugo 2026-07-31): o Percorrido como
// variável de decisão do compositor.
//
// ESTES TESTES GUARDAM DECISÕES, NÃO DETALHES DE COPY. Se um deles falhar,
// leia o motivo antes de "consertar" a expectativa: a redação e o tom foram
// escolhidos pelo Hugo contra alternativas concretas, e a proibição de
// sequenciar é ESTRUTURAL (a reflexão mora DENTRO do slide).
// ---------------------------------------------------------------------------

/** Percorreu tudo (100%) e parou nas reflexões (8 de 41). O caso do Rinaldo. */
const PERCORREU_SEM_ELABORAR: StudentHomeIndicators = {
  ...BASE,
  subject: {
    ...BASE.subject,
    percorridoPct: 100,
    progressPct: 50,
    reflections: 8,
    reflectionsMax: 41,
    interactions: 7,
    interactionsMax: 8,
  },
  reference: { ...BASE.reference, progressAvgPct: 68, reflectionsAvg: 5 },
}

/** O OPOSTO: mal chegou ao conteúdo (20%), e por isso refletiu pouco. */
const NAO_CHEGOU_AO_CONTEUDO: StudentHomeIndicators = {
  ...PERCORREU_SEM_ELABORAR,
  subject: { ...PERCORREU_SEM_ELABORAR.subject, percorridoPct: 20, reflections: 2 },
}

describe("C.2 — o Percorrido separa dois alunos OPOSTOS que recebiam a mesma frase", () => {
  it("percorreu tudo x não chegou ao conteúdo → parágrafos DIFERENTES", () => {
    // Antes do Percorrido, ambos caíam no mesmo ramo genérico de "atrás" e
    // liam a mesma coisa, apesar de terem problemas opostos e precisarem de
    // intervenções opostas (voltar e registrar x retomar os estudos).
    const percorreu = buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")
    const naoChegou = buildRitmoSummary(NAO_CHEGOU_AO_CONTEUDO, "Rinaldo")

    expect(percorreu).not.toBe(naoChegou)
  })

  it("só quem percorreu de fato ouve 'você percorreu o conteúdo inteiro'", () => {
    expect(buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")).toContain(
      "você percorreu o conteúdo inteiro",
    )
    expect(buildRitmoSummary(NAO_CHEGOU_AO_CONTEUDO, "Rinaldo")).not.toContain(
      "você percorreu o conteúdo inteiro",
    )
  })
})

describe("C.4 — a redação aprovada pelo Hugo, palavra por palavra", () => {
  it("caso Rinaldo → a frase EXATA aprovada em 2026-07-31", () => {
    // Hugo: "acho que esse foi o melhor até agora." Igualdade exata é
    // deliberada: a frase é o produto, não uma aproximação dele.
    expect(buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")).toBe(
      "Rinaldo, você percorreu o conteúdo inteiro, isso é bom. Só que parou aí: 8 de 41 reflexões. O material você já tem na cabeça, falta transformar em registro.",
    )
  })

  it("os números vêm dos INDICADORES, nunca fixos no código", () => {
    const outro: StudentHomeIndicators = {
      ...PERCORREU_SEM_ELABORAR,
      subject: { ...PERCORREU_SEM_ELABORAR.subject, reflections: 3, reflectionsMax: 24 },
    }
    expect(buildRitmoSummary(outro, "Ana")).toContain("3 de 24 reflexões")
  })

  it("sem nome → a frase não quebra nem sobra vírgula solta", () => {
    const out = buildRitmoSummary(PERCORREU_SEM_ELABORAR)
    expect(out.startsWith("você percorreu o conteúdo inteiro")).toBe(true)
  })

  it("segue a fórmula: fato, validação curta, número cru, e o fecho que desarma", () => {
    const out = buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")
    expect(out).toContain("isso é bom") // (b) valida em três palavras
    expect(out).toContain("8 de 41 reflexões") // (c) número cru
    // (d) o fecho é o que torna a frase desarmante em vez de acusatória.
    expect(out).toContain("O material você já tem na cabeça")
  })
})

describe("C.3 — PROIBIDO SEQUENCIAR (regra estrutural, não estilística)", () => {
  // A reflexão mora DENTRO do slide (blockquote no meio do conteúdo). Quem
  // percorreu sem refletir PASSOU POR CIMA do exercício, não deixou uma etapa
  // posterior para depois. "Primeiro avance, depois volte para refletir"
  // ensinaria exatamente o comportamento que o Percorrido existe para expor.
  const MATRIZ: Array<[string, StudentHomeIndicators]> = [
    ["percorreu tudo, elaborou pouco", PERCORREU_SEM_ELABORAR],
    ["não chegou ao conteúdo", NAO_CHEGOU_AO_CONTEUDO],
    ["base (acima da média)", BASE],
    [
      "percorrido no limiar",
      {
        ...PERCORREU_SEM_ELABORAR,
        subject: { ...PERCORREU_SEM_ELABORAR.subject, percorridoPct: 95 },
      },
    ],
    [
      "percorreu tudo E elaborou tudo",
      {
        ...PERCORREU_SEM_ELABORAR,
        subject: { ...PERCORREU_SEM_ELABORAR.subject, reflections: 41 },
      },
    ],
  ]

  it.each(MATRIZ)("%s → nenhuma linguagem de ordem/etapa", (_nome, indicators) => {
    const out = buildRitmoSummary(indicators, "Rinaldo")
    expect(out).not.toMatch(/depois (volte|refl)/i)
    expect(out).not.toMatch(/primeiro .* depois/i)
    expect(out).not.toMatch(/em seguida/i)
  })
})

describe("C.1/C.5 — aditivo, sem regressão, e puro", () => {
  it("percorridoPct AUSENTE → comportamento pré-existente intocado", () => {
    const semPercorrido: StudentHomeIndicators = {
      ...PERCORREU_SEM_ELABORAR,
      subject: { ...PERCORREU_SEM_ELABORAR.subject, percorridoPct: undefined },
    }
    expect(buildRitmoSummary(semPercorrido, "Rinaldo")).not.toContain(
      "você percorreu o conteúdo inteiro",
    )
  })

  it("percorridoPct null (sem dado) → não inventa diagnóstico", () => {
    const semDado: StudentHomeIndicators = {
      ...PERCORREU_SEM_ELABORAR,
      subject: { ...PERCORREU_SEM_ELABORAR.subject, percorridoPct: null },
    }
    expect(buildRitmoSummary(semDado, "Rinaldo")).not.toContain("você percorreu o conteúdo inteiro")
  })

  it("sem denominador de reflexões → não cita 'X de Y' desonesto", () => {
    const semTeto: StudentHomeIndicators = {
      ...PERCORREU_SEM_ELABORAR,
      subject: { ...PERCORREU_SEM_ELABORAR.subject, reflectionsMax: 0 },
    }
    expect(buildRitmoSummary(semTeto, "Rinaldo")).not.toContain("você percorreu o conteúdo inteiro")
  })

  it("continua PURO: mesma entrada, mesma saída", () => {
    expect(buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")).toBe(
      buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo"),
    )
  })

  it("C.6 — sem travessão (—), regra da casa", () => {
    expect(buildRitmoSummary(PERCORREU_SEM_ELABORAR, "Rinaldo")).not.toContain("—")
  })
})
