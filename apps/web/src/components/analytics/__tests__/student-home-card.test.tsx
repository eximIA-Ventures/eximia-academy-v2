import type { ComparableMetricBlock } from "@/types/analytics"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentHomeCard } from "../student-home-card"

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
      unitName="Ribeirão Preto"
      continueHref="/courses/next"
    />,
  )
}

const toggleTo = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

// ---------------------------------------------------------------------------
// Defaults — opens on "Meu progresso"; comparison defaults to the TABLE.
// ---------------------------------------------------------------------------

describe("defaults do toggle", () => {
  it("abre em 'Meu progresso' (intent default), não em comparação", () => {
    renderCard()
    // The intent toggle shows "Meu progresso" active; the comparison table is
    // not mounted yet.
    expect(screen.getByRole("button", { name: "Meu progresso" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(screen.queryByTestId("comparison-insights-table")).toBeNull()
  })

  it("dentro de 'Como me comparo', a sub-vista default é a TABELA (não as barras)", () => {
    renderCard()
    toggleTo("Como me comparo")
    expect(screen.getByTestId("comparison-insights-table")).toBeInTheDocument()
    expect(screen.queryByText("Sinais principais")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CORREÇÃO 3 — clean hierarchy: the intent toggle IS the label; no view repeats
// its name as a heading (no duplicated "Meu progresso" title).
// ---------------------------------------------------------------------------

describe("CORREÇÃO 3 — hierarquia limpa, sem label duplicado", () => {
  it("não há título 'Meu progresso' duplicando o toggle (só o botão do toggle)", () => {
    renderCard()
    // The toggle button exists...
    expect(screen.getByRole("button", { name: "Meu progresso" })).toBeInTheDocument()
    // ...but there is NO heading duplicating it (showTitle=false on the headline).
    expect(screen.queryByRole("heading", { name: "Meu progresso" })).toBeNull()
  })

  it("o sub-toggle Tabela/Barras só existe DENTRO da vista de comparação", () => {
    renderCard()
    // Not present in the progress view.
    expect(screen.queryByRole("button", { name: "Tabela" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Barras" })).toBeNull()
    // Appears after switching to comparison.
    toggleTo("Como me comparo")
    expect(screen.getByRole("button", { name: "Tabela" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Barras" })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Bars survive as the detailed sub-view.
// ---------------------------------------------------------------------------

describe("barras preservadas como vista detalhada", () => {
  it("compareView 'Barras' mostra as barras SignalRow, tabela some", () => {
    renderCard()
    toggleTo("Como me comparo")
    toggleTo("Barras")
    expect(screen.getByText("Sinais principais")).toBeInTheDocument()
    expect(screen.queryByTestId("comparison-insights-table")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CORREÇÃO 2 — a single next-step CTA, invariant across every toggle state.
// ---------------------------------------------------------------------------

describe("CORREÇÃO 2 — CTA único e invariante", () => {
  it("existe exatamente UM 'Continuar' e ele não muda de href/texto ao alternar", () => {
    renderCard()
    const cta = () => screen.getByRole("link", { name: /continuar/i })
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    const href = cta().getAttribute("href")
    const text = cta().textContent
    expect(href).toBe("/courses/next")

    toggleTo("Como me comparo")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
    expect(cta().textContent).toBe(text)

    toggleTo("Barras")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)

    toggleTo("Meu progresso")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
    expect(cta().textContent).toBe(text)
  })
})
