import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PeriodFilter } from "../period-filter"

const options = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
]

describe("PeriodFilter", () => {
  it("renders all period options", () => {
    render(<PeriodFilter value="30d" onChange={() => {}} options={options} />)

    expect(screen.getByText("7 dias")).toBeInTheDocument()
    expect(screen.getByText("30 dias")).toBeInTheDocument()
    expect(screen.getByText("Tudo")).toBeInTheDocument()
  })

  it("calls onChange when clicking a period option", () => {
    const onChange = vi.fn()
    render(<PeriodFilter value="30d" onChange={onChange} options={options} />)

    fireEvent.click(screen.getByText("7 dias"))
    expect(onChange).toHaveBeenCalledWith("7d")
  })

  // RODADA 12 (E4) — a asserção era `bg-cerrado-600`, isto é, a pílula ativa
  // chumbada no laranja do mundo Padrão. O marcador de estado passou a seguir
  // `--world-accent`, então o teste passa a provar a INTENÇÃO (o realce vem do
  // mundo) em vez de congelar a cor de UM mundo — e a trava de regressão é
  // justamente não deixar `cerrado` voltar para cá.
  it("highlights active period with the world accent, not a hardcoded orange", () => {
    render(<PeriodFilter value="30d" onChange={() => {}} options={options} />)

    const activeButton = screen.getByText("30 dias")
    expect(activeButton.className).toContain("bg-[var(--world-accent)]")
    expect(activeButton.className).toContain("text-[var(--world-accent-fg)]")
    expect(activeButton.className).not.toContain("cerrado")
  })
})
