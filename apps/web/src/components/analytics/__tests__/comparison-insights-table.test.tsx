import type { ComparableMetricBlock } from "@/types/analytics"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ComparisonInsightsTable, buildCompareIndicators } from "../comparison-insights-table"

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

// Student ahead on most, BELOW on reflections (to prove "below = neutral, not red").
const STUDENT = block({
  consciousCompletionPct: 68,
  avgDepth: 4.2,
  completionPct: 75,
  distinctActiveDays: 12,
  reflectionCount: 2, // below the unit per-student average (4) → neutral, NOT red
  totalStudents: 1,
  activeStudents: 1,
})
const UNIT = block({
  totalStudents: 100,
  consciousCompletionPct: 50,
  avgDepth: 3.2,
  completionPct: 63,
  distinctActiveDays: 7,
  reflectionCount: 400, // /100 → média 4
})

// ---------------------------------------------------------------------------
// buildCompareIndicators — the 5 columns Hugo confirmed, in order.
// ---------------------------------------------------------------------------

describe("buildCompareIndicators — 5 indicadores nas colunas", () => {
  it("monta as 5 colunas na ordem confirmada pelo Hugo", () => {
    const cols = buildCompareIndicators(STUDENT, UNIT)
    expect(cols.map((c) => c.key)).toEqual([
      "conscious",
      "depth",
      "completion",
      "consistency",
      "reflections",
    ])
    // distinctActiveDays feeds "Consistência (dias)".
    const consist = cols.find((c) => c.key === "consistency")
    expect(consist?.subject).toBe(12)
    expect(consist?.reference).toBe(7)
    // Reflexões reference is the per-student unit average (400/100 = 4).
    expect(cols.find((c) => c.key === "reflections")?.reference).toBe(4)
  })

  it("usa a mediana do referenceStats como fallback quando a média direta falta", () => {
    const unitNoDepth = block({
      totalStudents: 100,
      reflectionCount: 400,
      referenceStats: {
        completionPct: { median: 60, p25: 40, p75: 80 },
        avgDepth: { median: 3.5, p25: 2, p75: 5 },
      },
    })
    // unitNoDepth has no avgDepth field → depth reference falls back to median 3.5.
    const cols = buildCompareIndicators(STUDENT, unitNoDepth)
    expect(cols.find((c) => c.key === "depth")?.reference).toBe(3.5)
  })
})

// ---------------------------------------------------------------------------
// Render — 2 rows, indicators in columns, hot only where Você stands out,
// Média neutral & never red.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — 2 linhas, indicadores nas colunas", () => {
  it("renderiza cabeçalhos das colunas + as 2 linhas Você / Média", () => {
    render(<ComparisonInsightsTable student={STUDENT} unit={UNIT} unitName="Ribeirão Preto" />)
    for (const label of [
      "Conclusão consciente",
      "Profundidade",
      "Conclusão",
      "Consistência (dias)",
      "Reflexões",
    ]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument()
    }
    expect(screen.getByText("Você")).toBeInTheDocument()
    expect(screen.getByText("Média · Ribeirão Preto")).toBeInTheDocument()
  })

  it("destaque QUENTE só nas células onde Você se sobressai; abaixo é NEUTRO (nunca vermelho)", () => {
    const { container } = render(
      <ComparisonInsightsTable student={STUDENT} unit={UNIT} unitName="Ribeirão Preto" />,
    )
    const subjectRow = screen.getByTestId("row-subject")
    const referenceRow = screen.getByTestId("row-reference")

    // Você stands out on 4 of 5 (conscious, depth, completion, consistency) and
    // is BELOW on reflections → exactly 4 hot cells, 1 neutral (never red).
    const hotCells = subjectRow.querySelectorAll('[data-hot="true"]')
    expect(hotCells).toHaveLength(4)
    expect(subjectRow.querySelectorAll('[data-hot="false"]')).toHaveLength(1)

    // The Média row is NEVER hot — a neutral rule in every column.
    expect(referenceRow.querySelectorAll('[data-hot="true"]')).toHaveLength(0)

    // Hot cells use the manager green (#10b981), NOT a punitive red.
    const firstHot = hotCells[0] as HTMLElement
    expect(firstHot.style.color).toBe("rgb(16, 185, 129)")
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
  })
})
