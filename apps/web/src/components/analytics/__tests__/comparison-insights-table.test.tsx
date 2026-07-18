import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  behindSeverityOf,
  formatFraction,
  formatRank,
  leituraFor,
  subjectColumnLabel,
  subjectPillFor,
  winnerOf,
} from "../comparison-insights-table"

// Fixture no espírito do exemplo aprovado do Hugo: Você mais recente (última
// atividade invertida → Você vence), Progresso Média maior (Você atrás → leitura
// acionável), Interações e Reflexões Você maior (leituras de reforço). SH-1.5 adiciona
// os denominadores de fração (interactionsMax/reflectionsMax) e o rank real
// (isTopEngagement). O fixture base NÃO é #1 (engajamento não vence a média por
// muito, mas o sinal isTopEngagement é falso por padrão).
// Round 2 (Hugo 2026-07-18): a Turma agora leva fração (interactionsMaxAvg /
// reflectionsMaxAvg / engagementMaxAvg) e a célula Você de Engajamento vira RANKING
// (engagementRank / engagementTotalStudents), não mais o score.
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 0, // hoje
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
    engagement: 14,
    interactions: 7,
    reflections: 8,
    interactionsMax: 10, // SH-1.5 — fração "7/10"
    reflectionsMax: 50, // SH-1.5 — fração "8/50"
    engagementRank: 3, // Round 2 — "3º de 15" na célula Você de Engajamento
    engagementTotalStudents: 15,
    lastCompletedLabel: "Módulo 2: Definir o Problema · 80%",
  },
  reference: {
    lastAccessAvgDays: 52,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 5,
    reflectionsAvg: 3,
    interactionsMaxAvg: 12, // Round 2 — Turma "5/12"
    reflectionsMaxAvg: 40, // Round 2 — Turma "3/40"
    engagementMaxAvg: 64, // Round 2 — Turma engajamento "9/64"
  },
}

// ---------------------------------------------------------------------------
// winnerOf — DIRECTION-AWARE (intocado pelo redesign transposto/SH-1.5).
// ---------------------------------------------------------------------------

describe("winnerOf — direction-aware", () => {
  it("higher: maior vence (progresso, interações, reflexões, engajamento)", () => {
    expect(winnerOf(75, 63, "higher")).toBe("subject")
    expect(winnerOf(50, 55, "higher")).toBe("reference")
  })
  it("lower: MENOR vence (última atividade, recência invertida)", () => {
    expect(winnerOf(1, 4, "lower")).toBe("subject") // menos dias = mais recente = vence
    expect(winnerOf(9, 4, "lower")).toBe("reference")
  })
  it("empate ou valor ausente → ninguém vence", () => {
    expect(winnerOf(5, 5, "higher")).toBeNull()
    expect(winnerOf(5, 5, "lower")).toBeNull()
    expect(winnerOf(null, 4, "lower")).toBeNull()
    expect(winnerOf(4, null, "higher")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — formatFraction: "X/Y" com denominador válido, degrada ao absoluto.
// ---------------------------------------------------------------------------

describe("formatFraction — fração honesta com degradação", () => {
  it("denominador > 0 → 'X/Y'", () => {
    expect(formatFraction(7, 10)).toBe("7/10")
    expect(formatFraction(41, 50)).toBe("41/50")
  })
  it("denominador 0/ausente → absoluto 'X' (AC10, sem NaN/Infinity)", () => {
    expect(formatFraction(7, 0)).toBe("7")
    expect(formatFraction(7, undefined)).toBe("7")
    expect(formatFraction(7, null)).toBe("7")
  })
})

// ---------------------------------------------------------------------------
// Round 2 (Hugo 2026-07-18) — formatRank: notação "{rank}º de {total}", degrada
// graciosamente a "—" em qualquer entrada malformada/ausente (nunca NaN/crash).
// ---------------------------------------------------------------------------

describe("formatRank — posição no ranking com degradação graciosa", () => {
  it("rank e total válidos → '{rank}º de {total}'", () => {
    expect(formatRank(3, 15)).toBe("3º de 15")
    expect(formatRank(1, 1)).toBe("1º de 1") // aluno sozinho na org
    expect(formatRank(1, 20)).toBe("1º de 20")
  })
  it("ausente/inválido → '—' (sem crash)", () => {
    expect(formatRank(undefined, 15)).toBe("—")
    expect(formatRank(3, undefined)).toBe("—")
    expect(formatRank(null, null)).toBe("—")
    expect(formatRank(0, 15)).toBe("—") // rank < 1
    expect(formatRank(16, 15)).toBe("—") // rank > total
    expect(formatRank(Number.NaN, 15)).toBe("—")
    expect(formatRank(3, Number.POSITIVE_INFINITY)).toBe("—")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — FORMATO TRANSPOSTO, 5 LINHAS na ordem/labels exatos do mockup do Hugo:
// | Indicador | Você | Turma | Como estou |. Última atividade → Progresso -
// conclusão → Interações realizadas → Reflexões realizadas → Engajamento.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — 5 linhas na ordem/labels do mockup (AC1/AC2)", () => {
  it("cabeçalho: Indicador | Você | Turma | Como estou (sem nome → 'Você', AC6)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of ["Indicador", "Você", "Turma", "Como estou"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // O header antigo "Leitura" NÃO existe mais.
    expect(screen.queryByText("Leitura")).not.toBeInTheDocument()
  })

  it("AC2 — labels exatos: Última atividade · Progresso - conclusão · Interações realizadas · Reflexões realizadas · Engajamento", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of [
      "Última atividade",
      "Progresso - conclusão",
      "Interações realizadas",
      "Reflexões realizadas",
      "Engajamento",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Labels antigos NÃO aparecem mais.
    for (const old of ["Progresso", "Sessões concluídas", "Reflexões", "Último acesso"]) {
      // "Progresso" e "Reflexões" são substrings dos novos; usamos getByText exato
      // via função para não casar parcialmente.
      expect(screen.queryByText((content) => content === old)).not.toBeInTheDocument()
    }
  })

  it("AC1 — ordem exata das 5 linhas no DOM", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const keys = ["lastAccess", "progress", "sessions", "reflections", "engagement"]
    for (let i = 0; i < keys.length - 1; i++) {
      const a = screen.getByTestId(`row-${keys[i]}`)
      const b = screen.getByTestId(`row-${keys[i + 1]}`)
      expect(a.compareDocumentPosition(b)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })

  it("Round 2 — frações nos DOIS lados: Interações 7/10·5/12 · Reflexões 8/50·3/40", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-sessions").textContent).toBe("7/10")
    expect(screen.getByTestId("cell-reference-sessions").textContent).toBe("5/12")
    expect(screen.getByTestId("cell-subject-reflections").textContent).toBe("8/50")
    expect(screen.getByTestId("cell-reference-reflections").textContent).toBe("3/40")
  })

  it("Round 2 — Turma degrada ao absoluto quando o denominador médio é ausente/0", () => {
    // Sem os *MaxAvg (ou 0), a célula Turma cai no absoluto — mesma degradação graciosa
    // do lado Você, sem NaN/crash.
    const noTurmaMax: StudentHomeIndicators = {
      ...INDICATORS,
      reference: {
        ...INDICATORS.reference,
        interactionsMaxAvg: 0,
        reflectionsMaxAvg: undefined,
      },
    }
    render(<ComparisonInsightsTable indicators={noTurmaMax} />)
    expect(screen.getByTestId("cell-reference-sessions").textContent).toBe("5")
    expect(screen.getByTestId("cell-reference-reflections").textContent).toBe("3")
  })

  it("AC10 — sem denominador as frações Você degradam ao absoluto (sem crash)", () => {
    const noMax: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, interactionsMax: 0, reflectionsMax: undefined },
    }
    render(<ComparisonInsightsTable indicators={noMax} />)
    expect(screen.getByTestId("cell-subject-sessions").textContent).toBe("7")
    expect(screen.getByTestId("cell-subject-reflections").textContent).toBe("8")
  })

  it("Round 2 — Engajamento: Você é RANKING ('3º de 15'), Turma é fração ('9/64')", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Célula Você: a posição no ranking, não o score bruto (14) nem uma fração.
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("3º de 15")
    expect(screen.getByTestId("cell-subject-engagement").textContent).not.toBe("14")
    // Célula Turma: a média de pontos como fração X/Y.
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9/64")
  })

  it("Round 2 — Engajamento Você degrada a '—' quando o rank vem ausente (sem crash)", () => {
    const noRank: StudentHomeIndicators = {
      ...INDICATORS,
      subject: {
        ...INDICATORS.subject,
        engagementRank: undefined,
        engagementTotalStudents: undefined,
      },
    }
    render(<ComparisonInsightsTable indicators={noRank} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("—")
  })

  it("valores restantes: Progresso 50% vs 55%, atividade hoje vs há 52 dias", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-progress").textContent).toBe("50%")
    expect(screen.getByTestId("cell-reference-progress").textContent).toBe("55%")
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe("hoje")
    expect(screen.getByTestId("cell-reference-lastAccess").textContent).toBe("há 52 dias")
  })

  it("REMOVIDO: coluna 'Onde você está' e setas de ordenação", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.queryByText("Onde você está")).not.toBeInTheDocument()
    expect(screen.queryByText("Módulo 2: Definir o Problema · 80%")).not.toBeInTheDocument()
    expect(container.querySelector("thead svg")).toBeNull()
  })

  it("destaque direction-aware: última atividade Você vence (0d < 52d); Progresso Média vence", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-lastAccess").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-lastAccess").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-progress").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-progress").getAttribute("data-win")).toBe("false")
  })

  // Round 3 (Hugo 2026-07-18) — REVERSÃO EXPLÍCITA do antigo "nunca vermelho".
  // O aluno atrás agora carrega severidade de COR (amarelo/vermelho). No fixture
  // base o único indicador atrás é Progresso (50 vs 55, gap ~9% → MILD/amarelo),
  // então esperamos o token de warning (semantic-warning), e NÃO o de sucesso.
  it("Round 3 — aluno atrás em Progresso vira AMARELO (mild), não mais cerrado neutro", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const chip = screen.getByTestId("leitura-progress")
    expect(chip.getAttribute("data-tone")).toBe("behind-mild")
    expect(chip.className).toContain("bg-semantic-warning/10")
    expect(chip.className).toContain("text-semantic-warning")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — coluna "Como estou" (AC6): frases mais longas, tom preservado
// (win/tie/behind). Round 2 (Hugo 2026-07-18): o prefixo "… " foi REMOVIDO — o
// texto começa direto pela palavra. A linha Engajamento tem a regra do rank real (AC7).
// ---------------------------------------------------------------------------

describe("coluna 'Como estou' — copy longa sem prefixo '… ' e tom preservado (AC6)", () => {
  it("acima da média → reforço: Interações/Reflexões 'acima da média', última atividade 'ativo acima da média'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("leitura-sessions").textContent).toBe("acima da média")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("leitura-reflections").textContent).toBe("acima da média")
    expect(screen.getByTestId("leitura-lastAccess").textContent).toBe("ativo acima da média")
  })

  it("chip tonal: fundo suave + ícone (svg); atrás usa severidade (amarelo mild)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const win = screen.getByTestId("leitura-sessions")
    expect(win.className).toContain("rounded-full")
    expect(win.className).toContain("bg-semantic-success/10")
    expect(win.querySelector("svg")).not.toBeNull()
    // Round 3 — atrás moderado (Progresso 50 vs 55) agora é AMARELO (semantic-warning),
    // não mais o cerrado único de antes.
    const behind = screen.getByTestId("leitura-progress")
    expect(behind.className).toContain("bg-semantic-warning/10")
    expect(behind.querySelector("svg")).not.toBeNull()
  })

  it("abaixo → COPY ainda acionável e não punitiva: Progresso atrás vira '1 sessão te recoloca no ritmo' (só a cor ganha severidade)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    // A COPY do convite é PRESERVADA (Round 3 muda a cor, não o texto).
    expect(leitura.textContent).toBe("1 sessão te recoloca no ritmo")
    // O tom agora carrega a severidade: mild (amarelo) neste gap de ~9%.
    expect(leitura.getAttribute("data-tone")).toBe("behind-mild")
  })

  it("empate → neutro 'no ritmo da turma' (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    expect(screen.getByTestId("leitura-progress").textContent).toBe("no ritmo da turma")
    expect(screen.getByTestId("leitura-progress").getAttribute("data-tone")).toBe("tie")
  })

  it("valor ausente → '—' sem chip (sem leitura, não é empate)", () => {
    const first: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastAccessDays: null },
    }
    render(<ComparisonInsightsTable indicators={first} />)
    const none = screen.getByTestId("leitura-lastAccess")
    expect(none.textContent).toBe("—")
    expect(none.getAttribute("data-tone")).toBe("none")
    expect(none.querySelector("svg")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 (AC7, BLOQUEANTE) — a linha Engajamento só mostra "1º da turma –
// Parabéns!" quando o rank REAL (isTopEngagement) confirma #1. Acima da média
// mas NÃO #1 → cai no fallback "acima da média". NUNCA hardcoded. Round 2 (Hugo
// 2026-07-18): sem o prefixo "… ".
// ---------------------------------------------------------------------------

describe("Engajamento — rank real gate (AC7)", () => {
  it("aluno #1 real (isTopEngagement true, e vence a média) → '1º da turma – Parabéns!'", () => {
    const top: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, engagement: 30, isTopEngagement: true },
    }
    render(<ComparisonInsightsTable indicators={top} />)
    const leitura = screen.getByTestId("leitura-engagement")
    expect(leitura.textContent).toBe("1º da turma – Parabéns!")
    expect(leitura.getAttribute("data-tone")).toBe("win")
  })

  it("acima da média mas NÃO #1 (engagement 14 > 9, isTopEngagement false) → fallback 'acima da média', NUNCA '1º da turma'", () => {
    // O fixture base já é este caso: vence a média mas isTopEngagement ausente.
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-engagement")
    expect(leitura.textContent).toBe("acima da média")
    expect(leitura.textContent).not.toContain("1º da turma")
    expect(leitura.getAttribute("data-tone")).toBe("win")
  })

  it("isTopEngagement true mas o aluno NÃO vence a média (edge) → NÃO mostra 1º lugar (winner manda)", () => {
    // Defensivo: se por algum motivo o sinal chega true mas o número não vence a
    // média, o gate de winnerOf ainda prevalece (a frase só entra em 'subject wins').
    const weird: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, engagement: 5, isTopEngagement: true },
      reference: { ...INDICATORS.reference, engagementAvg: 9 },
    }
    render(<ComparisonInsightsTable indicators={weird} />)
    expect(screen.getByTestId("leitura-engagement").textContent).not.toContain("1º da turma")
  })

  it("leituraFor puro (AC7): engagement + isTopEngagement gate", () => {
    // #1 real → 1º da turma.
    expect(leituraFor("engagement", 30, 9, "higher", true)).toEqual({
      text: "1º da turma – Parabéns!",
      tone: "win",
    })
    // vence a média mas não é #1 → fallback win.
    expect(leituraFor("engagement", 14, 9, "higher", false)).toEqual({
      text: "acima da média",
      tone: "win",
    })
    // #1 só vale para engajamento: outra linha ignora o sinal.
    expect(leituraFor("sessions", 7, 5, "higher", true)).toEqual({
      text: "acima da média",
      tone: "win",
    })
  })
})

// ---------------------------------------------------------------------------
// leituraFor puro — espelha winnerOf nas 3 direções de resultado (SH-1.5 copy,
// Round 2 sem prefixo "… ").
// ---------------------------------------------------------------------------

describe("leituraFor — espelha winnerOf (copy SH-1.5)", () => {
  it("win/tie/behind(severidade)/none", () => {
    expect(leituraFor("sessions", 7, 5, "higher")).toEqual({
      text: "acima da média",
      tone: "win",
    })
    expect(leituraFor("progress", 50, 50, "higher")).toEqual({
      text: "no ritmo da turma",
      tone: "tie",
    })
    // Round 3 — Última atividade 60d vs 4d (lower): atrás com gap enorme → severe.
    // A COPY é a mesma; o tom carrega a severidade.
    expect(leituraFor("lastAccess", 60, 4, "lower")).toEqual({
      text: "vamos retomar?",
      tone: "behind-severe",
    })
    // Atrás moderado (Progresso 50 vs 55, gap ~9%) → mild.
    expect(leituraFor("progress", 50, 55, "higher")).toEqual({
      text: "1 sessão te recoloca no ritmo",
      tone: "behind-mild",
    })
    expect(leituraFor("reflections", null, 3, "higher")).toEqual({ text: "—", tone: "none" })
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita: sem acesso ANTERIOR à visita
// atual (subject.lastAccessDays null), a célula Você mostra "Primeiro acesso".
// ---------------------------------------------------------------------------
describe("Última atividade (Você) — estado sem acesso anterior", () => {
  it("subject.lastAccessDays null → 'Primeiro acesso' na célula Você", () => {
    const first = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, lastAccessDays: null },
    }
    render(<ComparisonInsightsTable indicators={first} />)
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe("Primeiro acesso")
  })
})

// ---------------------------------------------------------------------------
// Coluna do sujeito parametrizável — "Eu (Nome)" no aluno logado (protagonismo,
// PONTO 1); num drill de gestor recebe o nome do aluno; sem nome → "Você".
// ---------------------------------------------------------------------------
describe("label da coluna do sujeito — parametrizável", () => {
  it("com studentFirstName='Rinaldo' → cabeçalho 'Eu (Rinaldo)'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo" />)
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
  })

  it("nome COMPLETO informado → usa só o primeiro nome: 'Eu (Rinaldo)'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} studentFirstName="Rinaldo Capitelli" />)
    expect(screen.getByText("Eu (Rinaldo)")).toBeInTheDocument()
  })

  it("subjectColumnLabel puro: vazio/espacos/ausente → 'Você'", () => {
    expect(subjectColumnLabel("  ")).toBe("Você")
    expect(subjectColumnLabel(null)).toBe("Você")
    expect(subjectColumnLabel(undefined)).toBe("Você")
    expect(subjectColumnLabel("Rinaldo Capitelli")).toBe("Eu (Rinaldo)")
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — behindSeverityOf: grau de atraso direction-aware,
// corte em SEVERE_BEHIND_THRESHOLD (30%). Valores concretos que cruzam os 30%.
// ---------------------------------------------------------------------------
describe("behindSeverityOf — mild vs severe cruzando os 30%", () => {
  it("higher (maior é melhor): abaixo até 30% → mild; acima de 30% → severe", () => {
    // gap = (reference - subject) / max(reference,1)
    expect(behindSeverityOf(50, 55, "higher")).toBe("mild") // (55-50)/55 = 0.0909 → mild
    expect(behindSeverityOf(90, 100, "higher")).toBe("mild") // 0.10 → mild
    expect(behindSeverityOf(70, 100, "higher")).toBe("mild") // exatamente 0.30 → NÃO > 0.30 → mild
    expect(behindSeverityOf(69, 100, "higher")).toBe("severe") // 0.31 → severe
    expect(behindSeverityOf(10, 100, "higher")).toBe("severe") // 0.90 → severe
  })

  it("lower (menor é melhor, ex.: última atividade em dias): excedeu p/ pior", () => {
    // gap = (subject - reference) / max(reference,1)
    expect(behindSeverityOf(5, 4, "lower")).toBe("mild") // (5-4)/4 = 0.25 → mild
    expect(behindSeverityOf(6, 4, "lower")).toBe("severe") // (6-4)/4 = 0.50 → severe
    expect(behindSeverityOf(60, 4, "lower")).toBe("severe") // 14 → severe
  })

  it("reference 0 não estoura (divisor Math.max(reference,1))", () => {
    expect(behindSeverityOf(5, 0, "lower")).toBe("severe") // (5-0)/1 = 5 → severe
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — subjectPillFor: pill do valor Você por vencedor +
// tom da Leitura. Vitória → verde; atrás → cor da severidade; empate/ausente/turma → null.
// ---------------------------------------------------------------------------
describe("subjectPillFor — pill do valor da célula Você", () => {
  it("aluno vence → 'win' (verde)", () => {
    expect(subjectPillFor("subject", "win")).toBe("win")
  })
  it("aluno atrás → cor da severidade (mild/severe)", () => {
    expect(subjectPillFor("reference", "behind-mild")).toBe("behind-mild")
    expect(subjectPillFor("reference", "behind-severe")).toBe("behind-severe")
  })
  it("empate / ausente / vencedor null → sem pill", () => {
    expect(subjectPillFor(null, "tie")).toBeNull()
    expect(subjectPillFor(null, "none")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — 2ª linha "Você fez N pontos" SÓ na célula Você de
// Engajamento; nenhuma outra linha tem essa legenda.
// ---------------------------------------------------------------------------
describe("Engajamento — 2ª linha 'Você fez N pontos' (Round 3)", () => {
  it("célula Você de Engajamento mostra a pontuação bruta em legenda muted", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const raw = screen.getByTestId("cell-subject-engagement-raw")
    expect(raw.textContent).toBe("Você fez 14 pontos") // s.engagement do fixture
    expect(raw.className).toContain("text-text-muted")
  })

  it("as outras 4 linhas NÃO têm a 2ª linha de pontuação bruta", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Só existe UM nó com o testid da legenda bruta, e ele vive na linha engagement.
    expect(container.querySelectorAll('[data-testid="cell-subject-engagement-raw"]').length).toBe(1)
    expect(screen.queryByText(/^Você fez \d+ pontos$/)).toBeInTheDocument()
    // Nenhuma legenda "Você fez" sob progress/sessions/reflections/lastAccess.
    const engRow = screen.getByTestId("row-engagement")
    expect(engRow.querySelector('[data-testid="cell-subject-engagement-raw"]')).not.toBeNull()
    for (const key of ["lastAccess", "progress", "sessions", "reflections"]) {
      const row = screen.getByTestId(`row-${key}`)
      expect(row.textContent).not.toContain("Você fez")
    }
  })
})

// ---------------------------------------------------------------------------
// Round 3 (Hugo 2026-07-18) — severidade de COR (amarelo/vermelho) no CHIP e no
// PILL do valor Você quando atrás, em ≥2 linhas diferentes; Turma nunca destaca.
// ---------------------------------------------------------------------------
describe("Round 3 — severidade amarelo/vermelho quando atrás (chip + pill), ≥2 linhas", () => {
  // Fixture com o aluno ATRÁS em duas linhas de severidades diferentes:
  //  • Última atividade: 60 dias vs 4 (lower) → gap 14 → SEVERE (vermelho)
  //  • Progresso: 20% vs 80% (higher) → gap (80-20)/80 = 0.75 → SEVERE (vermelho)
  //  • Interações: 7 vs 8 (higher) → gap (8-7)/8 = 0.125 → MILD (amarelo)
  const BEHIND: StudentHomeIndicators = {
    ...INDICATORS,
    subject: {
      ...INDICATORS.subject,
      lastAccessDays: 60,
      progressPct: 20,
      interactions: 7,
    },
    reference: {
      ...INDICATORS.reference,
      lastAccessAvgDays: 4,
      progressAvgPct: 80,
      interactionsAvg: 8,
    },
  }

  it("CHIP: última atividade e progresso severos → VERMELHO (semantic-error)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    const last = screen.getByTestId("leitura-lastAccess")
    expect(last.getAttribute("data-tone")).toBe("behind-severe")
    expect(last.className).toContain("bg-semantic-error/10")
    expect(last.className).toContain("text-semantic-error")

    const prog = screen.getByTestId("leitura-progress")
    expect(prog.getAttribute("data-tone")).toBe("behind-severe")
    expect(prog.className).toContain("bg-semantic-error/10")
  })

  it("CHIP: interações levemente atrás → AMARELO (semantic-warning)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    const sess = screen.getByTestId("leitura-sessions")
    expect(sess.getAttribute("data-tone")).toBe("behind-mild")
    expect(sess.className).toContain("bg-semantic-warning/10")
    expect(sess.className).toContain("text-semantic-warning")
  })

  it("PILL do valor Você: vira pill colorido na cor da severidade (vermelho severe, amarelo mild)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    // Severe (vermelho) na última atividade e no progresso.
    const lastCell = screen.getByTestId("cell-subject-lastAccess")
    expect(lastCell.className).toContain("rounded-full")
    expect(lastCell.className).toContain("bg-semantic-error/10")
    const progCell = screen.getByTestId("cell-subject-progress")
    expect(progCell.className).toContain("bg-semantic-error/10")
    // Mild (amarelo) nas interações.
    const sessCell = screen.getByTestId("cell-subject-sessions")
    expect(sessCell.className).toContain("rounded-full")
    expect(sessCell.className).toContain("bg-semantic-warning/10")
  })

  it("Turma NUNCA destaca, mesmo quando ela é a vencedora (sem pill de cor)", () => {
    render(<ComparisonInsightsTable indicators={BEHIND} />)
    for (const key of ["lastAccess", "progress", "sessions"]) {
      const ref = screen.getByTestId(`cell-reference-${key}`)
      expect(ref.className).not.toContain("bg-semantic-error/10")
      expect(ref.className).not.toContain("bg-semantic-warning/10")
      expect(ref.className).not.toContain("rounded-full")
    }
  })

  it("empate continua neutro: sem pill de cor na célula Você (Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      subject: { ...INDICATORS.subject, progressPct: 50 },
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    const cell = screen.getByTestId("cell-subject-progress")
    expect(cell.className).not.toContain("bg-semantic-error/10")
    expect(cell.className).not.toContain("bg-semantic-warning/10")
    expect(cell.className).not.toContain("rounded-full")
  })
})
