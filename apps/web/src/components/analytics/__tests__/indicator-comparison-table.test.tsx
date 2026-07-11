import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { IndicatorComparisonTable, type IndicatorRow } from "../indicator-comparison-table"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function row(over: Partial<IndicatorRow>): IndicatorRow {
  return {
    key: over.key ?? "k",
    label: over.label ?? "Indicador",
    subjectValue: over.subjectValue ?? 0,
    referenceValue: over.referenceValue ?? 0,
    format: over.format ?? "int",
    referenceLabel: over.referenceLabel,
    highlight: over.highlight,
    neutral: over.neutral,
  }
}

// ---------------------------------------------------------------------------
// AC2 — highlight is hot; "abaixo" is NEUTRAL, never red/punitive.
// ---------------------------------------------------------------------------

describe("AC2 — highlight vs neutro (behind is never red)", () => {
  it("highlight row is HOT (biome color on the subject value)", () => {
    render(
      <IndicatorComparisonTable
        rows={[
          row({ key: "completed-sessions", subjectValue: 8, referenceValue: 4, highlight: true }),
        ]}
        subjectLabel="Você"
        referenceLabel="Média da unidade"
      />,
    )
    const rowEl = screen.getByTestId("indicator-row-completed-sessions")
    expect(rowEl.getAttribute("data-hot")).toBe("true")
    const value = screen.getByTestId("subject-value-completed-sessions")
    // Hot → the biome literal color travels inline (stale-CSS immunity).
    expect(value.style.color).toContain("oklch")
  })

  it("subject BELOW the reference, no highlight → NEUTRAL (not hot, not red)", () => {
    render(
      <IndicatorComparisonTable
        rows={[row({ key: "sessions", subjectValue: 3, referenceValue: 9 })]}
        subjectLabel="Você"
        referenceLabel="Média da unidade"
      />,
    )
    const rowEl = screen.getByTestId("indicator-row-sessions")
    // Below the reference must NOT be hot...
    expect(rowEl.getAttribute("data-hot")).toBe("false")
    const value = screen.getByTestId("subject-value-sessions")
    // ...and carries no inline color (neutral text token, never a red literal).
    expect(value.style.color).toBe("")
    // Hard guard: no destructive/red class anywhere in the rendered row.
    expect(rowEl.className).not.toMatch(/red|destructive/i)
    expect(rowEl.innerHTML).not.toMatch(/text-red|bg-red|border-red|destructive/i)
    // The directional word is present but neutral (muted), not punitive.
    const hint = within(rowEl).getByTestId("comparison-hint")
    expect(hint.textContent).toBe("abaixo")
    expect(hint.className).toMatch(/text-text-muted/)
    expect(hint.className).not.toMatch(/red|error|destructive/i)
  })

  it("colorScheme 'neutral' disables biome even on a highlight row (AC6)", () => {
    render(
      <IndicatorComparisonTable
        rows={[
          row({ key: "completed-sessions", subjectValue: 8, referenceValue: 4, highlight: true }),
        ]}
        subjectLabel="Time"
        referenceLabel="Org"
        colorScheme="neutral"
      />,
    )
    const rowEl = screen.getByTestId("indicator-row-completed-sessions")
    expect(rowEl.getAttribute("data-hot")).toBe("false")
    expect(screen.getByTestId("subject-value-completed-sessions").style.color).toBe("")
  })
})

// ---------------------------------------------------------------------------
// AC3 — neutral rows are pure context: never colored, never a comparison hint.
// ---------------------------------------------------------------------------

describe("AC3 — neutral suprime cor e hint (contexto puro)", () => {
  it("neutral row is never hot even when highlight is true, and shows no hint", () => {
    render(
      <IndicatorComparisonTable
        rows={[
          row({
            key: "reflections",
            subjectValue: 2,
            referenceValue: 5,
            highlight: true,
            neutral: true,
          }),
        ]}
        subjectLabel="Você"
        referenceLabel="Média da unidade"
      />,
    )
    const rowEl = screen.getByTestId("indicator-row-reflections")
    expect(rowEl.getAttribute("data-neutral")).toBe("true")
    expect(rowEl.getAttribute("data-hot")).toBe("false")
    // Pure context → no directional hint at all.
    expect(within(rowEl).queryByTestId("comparison-hint")).toBeNull()
    // And no color leaks onto the value.
    expect(screen.getByTestId("subject-value-reflections").style.color).toBe("")
  })
})

// ---------------------------------------------------------------------------
// AC4 / AC8 — suppressComparison hides the hint; values + bar stay; no "+525%".
// ---------------------------------------------------------------------------

describe("AC4/AC8 — suppressComparison esconde delta/'abaixo', mantém valores+barra", () => {
  it("no hint anywhere when suppressComparison is true; values still render", () => {
    render(
      <IndicatorComparisonTable
        rows={[
          row({ key: "sessions", subjectValue: 3, referenceValue: 9 }),
          row({ key: "completed-sessions", subjectValue: 8, referenceValue: 4, highlight: true }),
        ]}
        subjectLabel="Você"
        referenceLabel="Média da unidade"
        suppressComparison
      />,
    )
    // No directional hint on ANY row.
    expect(screen.queryAllByTestId("comparison-hint")).toHaveLength(0)
    // Raw values still visible (bar + numbers survive suppression).
    expect(screen.getByTestId("subject-value-sessions").textContent).toBe("3")
    expect(screen.getByTestId("subject-value-completed-sessions").textContent).toBe("8")
    // The misleading relative percentage never appears — no "%" delta artifact.
    const table = screen.getByTestId("indicator-comparison-table")
    expect(table.textContent ?? "").not.toMatch(/\+\d+%/)
  })
})

// ---------------------------------------------------------------------------
// AC7 — the SAME component renders "aluno × média da unidade" and "time × org",
// both derived from a ComparableMetricBlock-like shape, with no data adaptation.
// ---------------------------------------------------------------------------

// A minimal ComparableMetricBlock-like shape (only the fields these rows need).
interface BlockLike {
  avgSessionsPerStudent: number
  completedSessions: number
  reflectionCount: number
}

/** Pure inline mapping from two blocks → IndicatorRow[]. Semantics is generic. */
function rowsFromBlocks(subject: BlockLike, reference: BlockLike): IndicatorRow[] {
  return [
    {
      key: "sessions",
      label: "Sessões por período",
      subjectValue: subject.avgSessionsPerStudent,
      referenceValue: reference.avgSessionsPerStudent,
      format: "decimal",
    },
    {
      key: "completed-sessions",
      label: "Sessões concluídas",
      subjectValue: subject.completedSessions,
      referenceValue: reference.completedSessions,
      format: "int",
      highlight: subject.completedSessions >= reference.completedSessions,
    },
    {
      key: "reflections",
      label: "Reflexões escritas",
      subjectValue: subject.reflectionCount,
      referenceValue: reference.reflectionCount,
      format: "int",
      neutral: true,
    },
  ]
}

describe("AC7 — reuso aluno↔gestor sem adaptação de dados", () => {
  it("renders an 'aluno × média da unidade' scenario", () => {
    const rows = rowsFromBlocks(
      { avgSessionsPerStudent: 13, completedSessions: 8, reflectionCount: 4 },
      { avgSessionsPerStudent: 10, completedSessions: 4, reflectionCount: 6 },
    )
    render(
      <IndicatorComparisonTable
        rows={rows}
        subjectLabel="Você"
        referenceLabel="Média da unidade"
      />,
    )
    expect(screen.getByTestId("indicator-comparison-table")).toBeInTheDocument()
    expect(screen.getByText(/barra superior: Você/)).toBeInTheDocument()
    // completed-sessions leads → hot; reflections is neutral context.
    expect(screen.getByTestId("indicator-row-completed-sessions").getAttribute("data-hot")).toBe(
      "true",
    )
    expect(screen.getByTestId("indicator-row-reflections").getAttribute("data-neutral")).toBe(
      "true",
    )
  })

  it("renders a 'time × org' scenario with the SAME component, no adaptation", () => {
    const rows = rowsFromBlocks(
      { avgSessionsPerStudent: 6, completedSessions: 40, reflectionCount: 12 },
      { avgSessionsPerStudent: 9, completedSessions: 55, reflectionCount: 12 },
    )
    render(<IndicatorComparisonTable rows={rows} subjectLabel="Time Alfa" referenceLabel="Org" />)
    expect(screen.getByText(/barra superior: Time Alfa · inferior: Org/)).toBeInTheDocument()
    // team is behind on completed-sessions → NOT hot, and still not red (neutral).
    const behindRow = screen.getByTestId("indicator-row-completed-sessions")
    expect(behindRow.getAttribute("data-hot")).toBe("false")
    expect(behindRow.innerHTML).not.toMatch(/text-red|bg-red|border-red|destructive/i)
    expect(within(behindRow).getByTestId("comparison-hint").textContent).toBe("abaixo")
  })
})
