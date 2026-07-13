import type { StudentHomeIndicators } from "@/types/analytics"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ComparisonInsightsTable, winnerOf } from "../comparison-insights-table"

// Você mais recente (último acesso invertido → Você vence), ritmo no_ritmo + 58%
// em dia (sem vencedor), Progresso Média maior (destaque na MÉDIA), Engajamento
// Você maior (destaque em Você).
const INDICATORS: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 1,
    ritmoDisplay: "no_ritmo",
    progressPct: 50,
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
    expect(screen.getByText("Média da turma")).toBeInTheDocument()
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

  it("FRENTE 2: Engajamento mostra número + 'X interações · Y reflexões' nas 2 linhas", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    // Você: score 14 + sublinha 6 interações · 2 reflexões.
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14")
    expect(screen.getByText("6 interações · 2 reflexões")).toBeInTheDocument()
    // Média: score 9 + sublinha média 4 interações · 1 reflexão.
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9")
    expect(screen.getByText("4 interações · 1 reflexões")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SH-F.5 — o topo do Você vira fração "X de N" (só o Você; Média absoluta),
// sublinha intocada, winner só do absoluto, edge X>N são.
// ---------------------------------------------------------------------------

const withMax = (engagementMax: number, engagement = INDICATORS.subject.engagement) => ({
  ...INDICATORS,
  subject: { ...INDICATORS.subject, engagement, engagementMax },
})

describe("SH-F.5 — Engajamento fração X de N", () => {
  it("AC4: com engagementMax → topo do Você = 'X de N'; Média (AC6) absoluta '9'", () => {
    render(<ComparisonInsightsTable indicators={withMax(40)} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14 de 40")
    expect(screen.getByTestId("cell-reference-engagement").textContent).toBe("9")
  })

  it("AC4: sem engagementMax → degrada para o absoluto 'X'", () => {
    render(<ComparisonInsightsTable indicators={INDICATORS} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14")
  })

  it("AC5: sublinha absoluta INTOCADA mesmo com a fração no topo", () => {
    render(<ComparisonInsightsTable indicators={withMax(40)} />)
    expect(screen.getByText("6 interações · 2 reflexões")).toBeInTheDocument()
  })

  it("AC7: o denominador NÃO move o vencedor (winner só do absoluto)", () => {
    // winnerOf compara os absolutos, independente de N.
    expect(winnerOf(14, 9, "higher")).toBe("subject")
    // Com N grande, Você (14) ainda vence a Média (9).
    render(<ComparisonInsightsTable indicators={withMax(200)} />)
    expect(screen.getByTestId("cell-subject-engagement").getAttribute("data-win")).toBe("true")
    expect(screen.getByTestId("cell-reference-engagement").getAttribute("data-win")).toBe("false")
  })

  it("AC11: X > N renderiza a fração honesta 'X de N' sem clamp, sem NaN/quebra", () => {
    const { container } = render(<ComparisonInsightsTable indicators={withMax(10, 14)} />)
    expect(screen.getByTestId("cell-subject-engagement").textContent).toBe("14 de 10")
    expect(container.innerHTML).not.toMatch(/NaN|undefined/)
  })
})
