import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentHomeCard } from "../student-home-card"

const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 1,
    ritmoDisplay: "no_ritmo",
    progressPct: 72,
    engagement: 14,
    interactions: 6,
    reflections: 2,
  },
  reference: {
    lastAccessAvgDays: 4,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
    interactionsAvg: 4,
    reflectionsAvg: 1,
  },
}

function block(over: Partial<ComparableMetricBlock>): ComparableMetricBlock {
  return {
    totalStudents: over.totalStudents ?? 100,
    activeStudents: over.activeStudents ?? 60,
    completedSessions: over.completedSessions ?? 6,
    totalSessions: over.totalSessions ?? 8,
    reflectionCount: over.reflectionCount ?? 8,
    avgSessionsPerStudent: over.avgSessionsPerStudent ?? 13,
    completionPct: over.completionPct ?? 75,
    ...over,
  }
}

const STUDENT = block({
  completedSessions: 8,
  reflectionCount: 8,
  avgSessionsPerStudent: 13,
  completionPct: 75,
  totalStudents: 1,
  activeStudents: 1,
  consciousCompletionPct: 68,
  avgDepth: 4.2,
  distinctActiveDays: 12,
})
const UNIT = block({
  totalStudents: 100,
  activeStudents: 20,
  completedSessions: 500,
  reflectionCount: 400,
  avgSessionsPerStudent: 5.9,
  completionPct: 63,
  consciousCompletionPct: 50,
  avgDepth: 3.2,
  distinctActiveDays: 7,
})

function renderCard() {
  return render(
    <StudentHomeCard
      student={STUDENT}
      unit={UNIT}
      indicators={INDICATORS}
      continueHref="/courses/next"
    />,
  )
}

const clickBtn = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

// ---------------------------------------------------------------------------
// MUDANÇA 1 — the comparison is the DEFAULT and ONLY content; no intent toggle,
// no progress view.
// ---------------------------------------------------------------------------

describe("MUDANÇA 1 — comparação é a vista única (sem 'Meu progresso')", () => {
  it("mostra a tabela de comparação por default", () => {
    renderCard()
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
  })

  it("NÃO existe o toggle de intenção 'Meu progresso' / 'Como me comparo'", () => {
    renderCard()
    expect(screen.queryByRole("button", { name: "Meu progresso" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Como me comparo" })).toBeNull()
    // e nenhuma manchete de progresso.
    expect(screen.queryByRole("heading", { name: "Meu progresso" })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MUDANÇA 2 — ONE toggle only: [Visão detalhada] (default) / [Gráficos].
// ---------------------------------------------------------------------------

describe("MUDANÇA 2 — um único toggle Visão detalhada / Gráficos", () => {
  it("tem exatamente 2 botões de toggle, com as labels exatas do Hugo", () => {
    renderCard()
    // The only two toggle buttons in the card.
    expect(screen.getByRole("button", { name: "Visão detalhada" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gráficos" })).toBeInTheDocument()
    // Old sub-toggle labels are gone.
    expect(screen.queryByRole("button", { name: "Tabela" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Barras" })).toBeNull()
  })

  it("'Visão detalhada' é o default (tabela); 'Gráficos' mostra as barras", () => {
    renderCard()
    expect(
      screen.getByRole("button", { name: "Visão detalhada" }).getAttribute("aria-pressed"),
    ).toBe("true")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
    expect(screen.queryByText("Sinais principais")).toBeNull()

    // → Gráficos: bars appear, table hides, and the active pill follows.
    clickBtn("Gráficos")
    expect(screen.getByText("Sinais principais")).toBeInTheDocument()
    expect(screen.queryByTestId("comparison-insights-table")).toBeNull()
    expect(screen.getByRole("button", { name: "Gráficos" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(
      screen.getByRole("button", { name: "Visão detalhada" }).getAttribute("aria-pressed"),
    ).toBe("false")

    // back to Visão detalhada.
    clickBtn("Visão detalhada")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The single CTA is preserved.
// ---------------------------------------------------------------------------

describe("CTA único preservado", () => {
  it("existe exatamente UM 'Continuar' e ele não muda ao alternar o formato", () => {
    renderCard()
    const cta = () => screen.getByRole("link", { name: /continuar/i })
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    const href = cta().getAttribute("href")
    expect(href).toBe("/courses/next")

    clickBtn("Gráficos")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
  })
})

// ---------------------------------------------------------------------------
// M1 — the CTA now renders BELOW the comparison card. M2 — the reference is the
// TURMA (subtitle), never a named unidade.
// ---------------------------------------------------------------------------

describe("M1/M2 — CTA embaixo do card + escopo turma", () => {
  it("M1: a faixa CTA renderiza DEPOIS do card de comparação (ordem no DOM)", () => {
    renderCard()
    const table = screen.getByTestId("comparison-insights-table")
    const cta = screen.getByRole("link", { name: /continuar/i })
    // cta follows the table and is not contained by it → DOCUMENT_POSITION_FOLLOWING.
    expect(table.compareDocumentPosition(cta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("M2: título 'Meu ritmo' + subtítulo em 'turma', sem unidade nomeada", () => {
    renderCard()
    expect(screen.getByRole("heading", { name: "Meu ritmo" })).toBeInTheDocument()
    expect(screen.getByText(/em relação à turma/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ribeirão/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PONTO 1 (Hugo 2026-07-14) — copy em PRIMEIRA pessoa: o subtítulo dá
// protagonismo ao aluno ("Como estou...") e, quando o placar tem maioria,
// reforça "estou à frente/atrás da turma" de forma discreta.
// ---------------------------------------------------------------------------
describe("copy 1ª pessoa — subtítulo do Meu ritmo", () => {
  it("subtítulo em 1ª pessoa: 'Como estou em relação à turma...'", () => {
    renderCard()
    expect(screen.getByText(/Como estou em relação à turma nos últimos 30 dias/)).toBeInTheDocument()
    expect(screen.queryByText(/Como você está/)).toBeNull()
  })

  it("com maioria de vitórias no fixture, o subtítulo reforça 'estou à frente da turma'", () => {
    renderCard()
    expect(screen.getByText(/estou à frente da turma/)).toBeInTheDocument()
  })
})
