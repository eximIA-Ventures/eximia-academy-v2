import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SummaryCards } from "../summary-cards"

describe("SummaryCards", () => {
  const items = [
    { icon: <span data-testid="icon-1">I1</span>, label: "Cursos Inscritos", value: 3 },
    { icon: <span data-testid="icon-2">I2</span>, label: "Sessoes Completadas", value: 12 },
    { icon: <span data-testid="icon-3">I3</span>, label: "Capítulos Concluidos", value: 8 },
  ]

  it("renders 3 cards with icon, label, and value", () => {
    render(<SummaryCards items={items} />)

    expect(screen.getByText("Cursos Inscritos")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("Sessoes Completadas")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("Capítulos Concluidos")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
  })

  it("renders icons", () => {
    render(<SummaryCards items={items} />)

    expect(screen.getByTestId("icon-1")).toBeInTheDocument()
    expect(screen.getByTestId("icon-2")).toBeInTheDocument()
    expect(screen.getByTestId("icon-3")).toBeInTheDocument()
  })

  it("renders trend text when provided", () => {
    const itemsWithTrend = [
      { icon: <span>I</span>, label: "Test", value: 5, trend: "+10% esta semana" },
    ]
    render(<SummaryCards items={itemsWithTrend} />)

    expect(screen.getByText("+10% esta semana")).toBeInTheDocument()
  })

  it("handles string values", () => {
    const stringItems = [{ icon: <span>I</span>, label: "Status", value: "Ativo" }]
    render(<SummaryCards items={stringItems} />)

    expect(screen.getByText("Ativo")).toBeInTheDocument()
  })
})
