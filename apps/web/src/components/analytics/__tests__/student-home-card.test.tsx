import type { ComparableMetricBlock } from "@/types/analytics"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentHomeCard } from "../student-home-card"

// ---------------------------------------------------------------------------
// Block builders — a student clearly AHEAD on some metrics and a healthy unit.
// ---------------------------------------------------------------------------

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
})
// Unit of 100 → averages: completed 5, reflections 4, active 20%. Comparable.
const UNIT = block({
  totalStudents: 100,
  activeStudents: 20,
  completedSessions: 500,
  reflectionCount: 400,
  avgSessionsPerStudent: 5.9,
  completionPct: 63,
})

function renderCard(unit: ComparableMetricBlock = UNIT) {
  return render(
    <StudentHomeCard
      student={STUDENT}
      unit={unit}
      unitName="Ribeirão Preto"
      continueHref="/courses/next"
    />,
  )
}

const toggleTo = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

// ---------------------------------------------------------------------------
// AC2/AC3 — defaults: opens on "Meu progresso"; compare defaults to the table.
// ---------------------------------------------------------------------------

describe("AC2/AC3 — defaults do toggle", () => {
  it("abre em 'Meu progresso' (intent default), não em comparação", () => {
    renderCard()
    // Progress view heading present; compare view heading absent.
    expect(screen.getByRole("heading", { name: "Meu progresso" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Como me comparo" })).toBeNull()
    // Comparison content not mounted yet.
    expect(screen.queryByTestId("indicator-comparison-table")).toBeNull()
  })

  it("dentro de 'Como me comparo', a sub-vista default é a TABELA, não as barras", () => {
    renderCard()
    toggleTo("Como me comparo")
    // Table shown, bars ("Sinais principais") not the default sub-view.
    expect(screen.getByTestId("indicator-comparison-table")).toBeInTheDocument()
    expect(screen.queryByText("Sinais principais")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC4 — the bars survive as the detailed sub-view (compareView: 'bars').
// ---------------------------------------------------------------------------

describe("AC4 — barras preservadas como vista detalhada", () => {
  it("compareView 'bars' mostra as barras SignalRow, tabela some", () => {
    renderCard()
    toggleTo("Como me comparo")
    toggleTo("Barras")
    expect(screen.getByText("Sinais principais")).toBeInTheDocument()
    expect(screen.queryByTestId("indicator-comparison-table")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC5 — CTA invariance: href + text identical across EVERY toggle state, and
// there is always EXACTLY ONE "Continuar agora" link (rendered outside switch).
// ---------------------------------------------------------------------------

describe("AC5 — invariância do CTA 'Continuar agora'", () => {
  it("href e texto do CTA são idênticos entre progress/compare e table/bars", () => {
    renderCard()

    const cta = () => screen.getByRole("link", { name: /continuar/i })
    // Exactly one CTA link in the initial (progress) state.
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    const href = cta().getAttribute("href")
    const text = cta().textContent
    expect(href).toBe("/courses/next")

    // progress → compare (table)
    toggleTo("Como me comparo")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
    expect(cta().textContent).toBe(text)

    // table → bars
    toggleTo("Barras")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
    expect(cta().textContent).toBe(text)

    // back to progress
    toggleTo("Meu progresso")
    expect(screen.getAllByRole("link", { name: /continuar/i })).toHaveLength(1)
    expect(cta().getAttribute("href")).toBe(href)
    expect(cta().textContent).toBe(text)
  })
})

// ---------------------------------------------------------------------------
// AC6 — suppressComparison is derived from unit.totalStudents < threshold and
// passed to the table (which then hides the directional hint).
// ---------------------------------------------------------------------------

describe("AC6 — suppressComparison derivado de totalStudents", () => {
  it("unidade pequena (totalStudents < 5) suprime o hint de comparação", () => {
    renderCard(
      block({ totalStudents: 3, activeStudents: 1, completedSessions: 4, reflectionCount: 3 }),
    )
    toggleTo("Como me comparo")
    expect(screen.getByTestId("indicator-comparison-table")).toBeInTheDocument()
    // Suppressed → no directional "abaixo/acima" hint anywhere.
    expect(screen.queryAllByTestId("comparison-hint")).toHaveLength(0)
  })

  it("unidade com massa (totalStudents >= 5) mostra o hint de comparação", () => {
    renderCard() // UNIT.totalStudents = 100
    toggleTo("Como me comparo")
    expect(screen.queryAllByTestId("comparison-hint").length).toBeGreaterThan(0)
  })
})
