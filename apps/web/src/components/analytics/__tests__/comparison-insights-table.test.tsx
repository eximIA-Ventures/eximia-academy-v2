import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  leituraFor,
  subjectColumnLabel,
  winnerOf,
} from "../comparison-insights-table"

// Fixture no espírito do exemplo aprovado do Hugo: Você mais recente (último
// acesso invertido → Você vence), Progresso Média maior (Você atrás → leitura
// acionável), Sessões e Reflexões Você maior (leituras de reforço).
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 0, // hoje
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
    engagement: 14,
    interactions: 7,
    reflections: 8,
    lastCompletedLabel: "Módulo 2: Definir o Problema · 80%",
  },
  reference: {
    lastAccessAvgDays: 52,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 5,
    reflectionsAvg: 3,
  },
}

// ---------------------------------------------------------------------------
// winnerOf — DIRECTION-AWARE (intocado pelo redesign transposto).
// ---------------------------------------------------------------------------

describe("winnerOf — direction-aware", () => {
  it("higher: maior vence (progresso, sessões, reflexões)", () => {
    expect(winnerOf(75, 63, "higher")).toBe("subject")
    expect(winnerOf(50, 55, "higher")).toBe("reference")
  })
  it("lower: MENOR vence (último acesso, recência invertida)", () => {
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
// FORMATO TRANSPOSTO (Hugo 2026-07-14) — uma linha por indicador, colunas
// | Indicador | Você | Turma | Leitura |. Sem "Onde você está", sem sort.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — formato transposto", () => {
  it("cabeçalho: Indicador | Você | Turma | Leitura (sem nome → 'Você')", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of ["Indicador", "Você", "Turma", "Leitura"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("linhas na ordem: Progresso · Sessões concluídas · Reflexões · Último acesso", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const labels = ["Progresso", "Sessões concluídas", "Reflexões", "Último acesso"]
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Ordem no DOM: cada linha precede a seguinte.
    const keys = ["progress", "sessions", "reflections", "lastAccess"]
    for (let i = 0; i < keys.length - 1; i++) {
      const a = screen.getByTestId(`row-${keys[i]}`)
      const b = screen.getByTestId(`row-${keys[i + 1]}`)
      expect(a.compareDocumentPosition(b)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })

  it("valores: Progresso 50% vs 55%, Sessões 7 vs 5, Reflexões 8 vs 3, acesso hoje vs há 52 dias", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-progress").textContent).toBe("50%")
    expect(screen.getByTestId("cell-reference-progress").textContent).toBe("55%")
    expect(screen.getByTestId("cell-subject-sessions").textContent).toBe("7")
    expect(screen.getByTestId("cell-reference-sessions").textContent).toBe("5")
    expect(screen.getByTestId("cell-subject-reflections").textContent).toBe("8")
    expect(screen.getByTestId("cell-reference-reflections").textContent).toBe("3")
    expect(screen.getByTestId("cell-subject-lastAccess").textContent).toBe("hoje")
    expect(screen.getByTestId("cell-reference-lastAccess").textContent).toBe("há 52 dias")
  })

  it("REMOVIDO: coluna 'Onde você está' e setas de ordenação", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.queryByText("Onde você está")).not.toBeInTheDocument()
    expect(screen.queryByText("Módulo 2: Definir o Problema · 80%")).not.toBeInTheDocument()
    expect(screen.queryByText("Comparação")).not.toBeInTheDocument()
    // Sem ícone de sort (lucide ArrowUpDown renderiza um <svg>) no thead.
    expect(container.querySelector("thead svg")).toBeNull()
  })

  it("destaque direction-aware: Último acesso Você vence (0d < 52d); Progresso Média vence", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-lastAccess").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-lastAccess").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-progress").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-progress").getAttribute("data-win")).toBe("false")
  })

  it("nunca vermelho de reprovação, mesmo com o aluno atrás em Progresso", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
  })
})

// ---------------------------------------------------------------------------
// Coluna LEITURA — CHIP TONAL (ajuste fino Hugo 2026-07-14): fundo suave +
// cor semântica + ícone + inicial maiúscula; único elemento de cor da linha.
// Calibrada: acima = reforço; empate = neutro; abaixo = acionável, nunca punitivo.
// ---------------------------------------------------------------------------

describe("coluna Leitura — chip tonal calibrado por resultado", () => {
  it("acima da média → reforço com inicial maiúscula: 'Acima da média', 'Boa participação', 'Ativo'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("leitura-sessions").textContent).toBe("Acima da média")
    expect(screen.getByTestId("leitura-sessions").getAttribute("data-tone")).toBe("win")
    expect(screen.getByTestId("leitura-reflections").textContent).toBe("Boa participação")
    expect(screen.getByTestId("leitura-lastAccess").textContent).toBe("Ativo")
  })

  it("chip tonal: fundo suave + ícone pequeno (svg) dentro do chip", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const win = screen.getByTestId("leitura-sessions")
    expect(win.className).toContain("rounded-full")
    expect(win.className).toContain("bg-semantic-success/10")
    expect(win.querySelector("svg")).not.toBeNull()
    const behind = screen.getByTestId("leitura-progress")
    expect(behind.className).toContain("bg-cerrado-600/10")
    expect(behind.querySelector("svg")).not.toBeNull()
  })

  it("valor VENCEDOR do aluno veste o PILL verde original (cápsula + texto branco)", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Aluno vence lastAccess/sessions/reflections no fixture → pill.
    for (const key of ["lastAccess", "sessions", "reflections"]) {
      const cell = screen.getByTestId(`cell-subject-${key}`)
      expect(cell.getAttribute("data-win")).toBe("true")
      expect(cell.className).toContain("rounded-full")
      expect(cell.getAttribute("style")).toContain("semantic-success")
      expect(cell.getAttribute("style")).toContain("rgb(255, 255, 255)")
    }
  })

  it("derrota e empate ficam texto neutro (sem pill); a coluna Turma nunca destaca", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    // Empate (Progresso 50 vs 50) → valor do aluno neutro, sem pill.
    const subjectTie = screen.getByTestId("cell-subject-progress")
    expect(subjectTie.className).not.toContain("rounded-full")
    expect(subjectTie.className).toContain("text-text-primary")
    // Turma muted sempre, mesmo quando vence um indicador.
    const refCell = screen.getByTestId("cell-reference-sessions")
    expect(refCell.className).toContain("text-text-muted")
    expect(refCell.className).not.toContain("rounded-full")
  })

  it("derrota do aluno (Progresso 50 < 55) → valor neutro; Turma vencedora também sem pill", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const losing = screen.getByTestId("cell-subject-progress")
    expect(losing.getAttribute("data-win")).toBe("false")
    expect(losing.className).not.toContain("rounded-full")
    // A Turma vencedora não ganha pill (destaque é só do aluno).
    const refWinner = screen.getByTestId("cell-reference-progress")
    expect(refWinner.getAttribute("data-win")).toBe("true")
    expect(refWinner.className).not.toContain("rounded-full")
  })

  it("abaixo → acionável e não punitivo: Progresso atrás vira '1 sessão te recoloca no ritmo'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    const leitura = screen.getByTestId("leitura-progress")
    expect(leitura.textContent).toBe("1 sessão te recoloca no ritmo")
    expect(leitura.getAttribute("data-tone")).toBe("behind")
  })

  it("empate → neutro 'No ritmo' (exemplo do Hugo: Progresso 50 vs 50)", () => {
    const tied: StudentHomeIndicators = {
      ...INDICATORS,
      reference: { ...INDICATORS.reference, progressAvgPct: 50 },
    }
    render(<ComparisonInsightsTable indicators={tied} />)
    expect(screen.getByTestId("leitura-progress").textContent).toBe("No ritmo")
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

  it("leituraFor puro: espelha winnerOf nas 3 direções de resultado", () => {
    expect(leituraFor("sessions", 7, 5, "higher")).toEqual({
      text: "Acima da média",
      tone: "win",
    })
    expect(leituraFor("progress", 50, 50, "higher")).toEqual({ text: "No ritmo", tone: "tie" })
    expect(leituraFor("lastAccess", 60, 4, "lower")).toEqual({
      text: "Vamos retomar?",
      tone: "behind",
    })
    expect(leituraFor("reflections", null, 3, "higher")).toEqual({ text: "—", tone: "none" })
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita: sem acesso ANTERIOR à visita
// atual (subject.lastAccessDays null), a célula Você mostra "Primeiro acesso".
// ---------------------------------------------------------------------------
describe("Último acesso (Você) — estado sem acesso anterior", () => {
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
