import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Mock recharts to avoid DOM measurement issues in JSDOM
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

import { EngagementChart } from "../engagement-chart"

const mockData = [
  { week: "2026-01-05", sessions: 15 },
  { week: "2026-01-12", sessions: 22 },
  { week: "2026-01-19", sessions: 18 },
]

describe("EngagementChart", () => {
  it("renders the chart container", () => {
    render(<EngagementChart data={mockData} />)

    expect(screen.getByText("Engajamento ao Longo do Tempo")).toBeInTheDocument()
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument()
    expect(screen.getByTestId("line-chart")).toBeInTheDocument()
  })

  it("includes aria-label for accessibility", () => {
    render(<EngagementChart data={mockData} />)

    expect(
      screen.getByLabelText("Grafico de sessoes por semana nas ultimas 12 semanas"),
    ).toBeInTheDocument()
  })

  it("renders screen reader fallback table", () => {
    render(<EngagementChart data={mockData} />)

    expect(screen.getByText("Sessões completadas por semana")).toBeInTheDocument()
  })
})
