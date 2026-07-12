import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { StudentHomeIndicators } from "@/types/analytics"
import { ComparisonInsightsTable, winnerOf } from "../comparison-insights-table"

// Você mais recente (último acesso invertido → Você vence), ritmo no_ritmo + 58%
// em dia (sem vencedor), Progresso Média maior (destaque na MÉDIA), Engajamento
// Você maior (destaque em Você).
const INDICATORS: StudentHomeIndicators = {
  subject: { lastAccessDays: 1, ritmoDisplay: "no_ritmo", progressPct: 50, engagement: 14 },
  reference: { lastAccessAvgDays: 4, ritmoEmDiaPct: 58, progressAvgPct: 55, engagementAvg: 9 },
}

// ---------------------------------------------------------------------------
// winnerOf — DIRECTION-AWARE.
// ---------------------------------------------------------------------------

describe("winnerOf — direction-aware", () => {
  it("higher: maior vence (progresso, engajamento)", () => {
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
// Render — 4 operational columns, 2 rows, direction-aware highlight, ritmo
// without a winner.
// ---------------------------------------------------------------------------

describe("ComparisonInsightsTable — 4 indicadores operacionais", () => {
  it("renderiza as 4 colunas na ordem + cabeçalho da 1a coluna + 2 linhas", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    for (const label of ["Comparação", "Último acesso", "Ritmo", "Progresso", "Engajamento"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText("Você")).toBeInTheDocument()
    expect(screen.getByText("Média da organização")).toBeInTheDocument()
  })

  it("Ritmo: badge no Você + '% em dia' na Média, SEM vencedor em nenhuma célula", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // RitmoBadge renders the "No ritmo" label; the reference shows "% em dia".
    expect(screen.getByText("No ritmo")).toBeInTheDocument()
    expect(screen.getByText("58% em dia")).toBeInTheDocument()
    expect(screen.getByTestId("cell-subject-ritmo").getAttribute("data-win")).toBe("false")
    expect(screen.getByTestId("cell-reference-ritmo").getAttribute("data-win")).toBe("false")
  })

  it("Último acesso INVERTIDO: Você mais recente (1d < 4d) vence", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-lastAccess").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-lastAccess").getAttribute("data-win")).toBe("false")
    expect(screen.getByText("há 1 dia")).toBeInTheDocument()
    expect(screen.getByText("há 4 dias")).toBeInTheDocument()
  })

  it("Progresso (maior vence): Média 55 > Você 50 → destaque na MÉDIA", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-reference-progress").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-subject-progress").getAttribute("data-win")).toBe("false")
  })

  it("Engajamento (maior vence): Você 14 > Média 9 → destaque em Você; nunca vermelho", () => {
    const { container } = render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-engagement").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-engagement").getAttribute("data-win")).toBe("false")
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|#ef|#dc2/i)
  })
})
