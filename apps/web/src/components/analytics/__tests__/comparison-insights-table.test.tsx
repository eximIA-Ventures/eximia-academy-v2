import type { ComparableMetricBlock } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ComparisonInsightsTable,
  buildCompareIndicators,
  winnerOf,
} from "../comparison-insights-table"

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

// Você wins conscious/completion/consistency; MÉDIA wins depth (4.6 > 4.0) and
// reflections (4 > 2). Proves the winner is marked on EITHER side, per indicator.
const STUDENT = block({
  consciousCompletionPct: 68,
  avgDepth: 4.0,
  completionPct: 75,
  distinctActiveDays: 12,
  reflectionCount: 2,
  totalStudents: 1,
  activeStudents: 1,
})
const UNIT = block({
  totalStudents: 100,
  consciousCompletionPct: 50,
  avgDepth: 4.6, // beats Você 4.0 → MÉDIA wins Profundidade
  completionPct: 63,
  distinctActiveDays: 7,
  reflectionCount: 400, // /100 → média 4, beats Você 2
})

// ---------------------------------------------------------------------------
// winnerOf — pure: higher value wins; tie/missing = null.
// ---------------------------------------------------------------------------

describe("winnerOf — vencedor por maior valor", () => {
  it("marca o lado com o maior valor, e null em empate/ausência", () => {
    expect(winnerOf(75, 63)).toBe("subject")
    expect(winnerOf(4.0, 4.6)).toBe("reference")
    expect(winnerOf(5, 5)).toBeNull() // empate → ninguém
    expect(winnerOf(null, 4)).toBeNull() // ausência → ninguém
    expect(winnerOf(4, null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildCompareIndicators — the 5 columns Hugo confirmed.
// ---------------------------------------------------------------------------

describe("buildCompareIndicators — 5 colunas na ordem confirmada", () => {
  it("monta as 5 colunas + referência per-student de Reflexões", () => {
    const cols = buildCompareIndicators(STUDENT, UNIT)
    expect(cols.map((c) => c.key)).toEqual([
      "conscious",
      "depth",
      "completion",
      "consistency",
      "reflections",
    ])
    expect(cols.find((c) => c.key === "reflections")?.reference).toBe(4) // 400/100
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
    expect(
      buildCompareIndicators(STUDENT, unitNoDepth).find((c) => c.key === "depth")?.reference,
    ).toBe(3.5)
  })
})

// ---------------------------------------------------------------------------
// Render — the WINNING cell of each indicator is highlighted (Você OR Média);
// the loser is neutral; never red.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — destaque na célula vencedora de cada indicador", () => {
  it("marca Você OU Média conforme quem vence cada indicador", () => {
    const { container } = render(<ComparisonInsightsTable student={STUDENT} unit={UNIT} />)
    const win = (id: string) => screen.getByTestId(id).getAttribute("data-win")

    // Você vence: conscious, completion, consistency.
    expect(win("cell-subject-conscious")).toBe("true")
    expect(win("cell-reference-conscious")).toBe("false")
    expect(win("cell-subject-completion")).toBe("true")
    expect(win("cell-subject-consistency")).toBe("true")

    // MÉDIA vence: reflections (4 > 2).
    expect(win("cell-reference-reflections")).toBe("true")
    expect(win("cell-subject-reflections")).toBe("false")

    // Never red anywhere.
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
  })

  it("M2/M3: rótulo da referência é 'Média da organização' e a 1a coluna tem cabeçalho", () => {
    render(<ComparisonInsightsTable student={STUDENT} unit={UNIT} />)
    // M2: the reference row is the ORGANIZATION, no named unidade.
    expect(screen.getByText("Média da organização")).toBeInTheDocument()
    expect(screen.queryByText(/Ribeirão/)).toBeNull()
    // M3: the entity column now has a header.
    expect(screen.getByText("Comparação")).toBeInTheDocument()
  })

  it("Profundidade: quando a Média (4.6) é maior que Você (4.0), o destaque vai para a MÉDIA (caso do Hugo)", () => {
    render(<ComparisonInsightsTable student={STUDENT} unit={UNIT} />)
    // The winning cell for depth is on the reference (Média) row, NOT Você.
    expect(screen.getByTestId("cell-reference-depth").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-depth").getAttribute("data-win")).toBe("false")
  })

  it("empate não destaca nenhum lado", () => {
    const tied = block({
      totalStudents: 100,
      consciousCompletionPct: 50,
      avgDepth: 4.6,
      completionPct: 63,
      distinctActiveDays: 7,
      reflectionCount: 200, // /100 → 2, EQUAL to STUDENT.reflectionCount=2 → tie
    })
    const me = block({ ...STUDENT, reflectionCount: 2, totalStudents: 1, activeStudents: 1 })
    render(<ComparisonInsightsTable student={me} unit={tied} />)
    expect(screen.getByTestId("cell-subject-reflections").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-reflections").getAttribute("data-win")).toBe("false")
  })
})
