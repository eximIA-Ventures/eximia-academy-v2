import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  formatFraction,
  formatRank,
  leituraFor,
  subjectColumnLabel,
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

  it("AC11 — nunca vermelho de reprovação, mesmo com o aluno atrás em Progresso", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
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

  it("chip tonal: fundo suave + ícone (svg); atrás usa cerrado (nunca vermelho)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const win = screen.getByTestId("leitura-sessions")
    expect(win.className).toContain("rounded-full")
    expect(win.className).toContain("bg-semantic-success/10")
    expect(win.querySelector("svg")).not.toBeNull()
    const behind = screen.getByTestId("leitura-progress")
    expect(behind.className).toContain("bg-cerrado-600/10")
    expect(behind.querySelector("svg")).not.toBeNull()
  })

  it("abaixo → acionável e não punitivo: Progresso atrás vira '1 sessão te recoloca no ritmo'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    expect(leitura.textContent).toBe("1 sessão te recoloca no ritmo")
    expect(leitura.getAttribute("data-tone")).toBe("behind")
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
  it("win/tie/behind/none", () => {
    expect(leituraFor("sessions", 7, 5, "higher")).toEqual({
      text: "acima da média",
      tone: "win",
    })
    expect(leituraFor("progress", 50, 50, "higher")).toEqual({
      text: "no ritmo da turma",
      tone: "tie",
    })
    expect(leituraFor("lastAccess", 60, 4, "lower")).toEqual({
      text: "vamos retomar?",
      tone: "behind",
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
