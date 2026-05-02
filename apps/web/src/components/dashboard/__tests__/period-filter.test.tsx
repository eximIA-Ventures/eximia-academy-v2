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

  it("highlights active period", () => {
    render(<PeriodFilter value="30d" onChange={() => {}} options={options} />)

    const activeButton = screen.getByText("30 dias")
    expect(activeButton.className).toContain("bg-accent-blue-mid")
  })
})
