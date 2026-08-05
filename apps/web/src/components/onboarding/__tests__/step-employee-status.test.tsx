import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { StepEmployeeStatus } from "../step-employee-status"

describe("StepEmployeeStatus", () => {
  it("renders corporate title", () => {
    render(<StepEmployeeStatus onChange={vi.fn()} />)
    expect(screen.getByText("Como podemos te ajudar?")).toBeInTheDocument()
  })

  it("renders 3 options", () => {
    render(<StepEmployeeStatus onChange={vi.fn()} />)
    expect(screen.getByText("É minha primeira vez aqui")).toBeInTheDocument()
    expect(screen.getByText("Já conheço a plataforma")).toBeInTheDocument()
    expect(screen.getByText("Estou retornando")).toBeInTheDocument()
  })

  it("calls onChange with correct value when option clicked", () => {
    const onChange = vi.fn()
    render(<StepEmployeeStatus onChange={onChange} />)
    fireEvent.click(screen.getByText("É minha primeira vez aqui"))
    expect(onChange).toHaveBeenCalledWith("new_needs_onboarding")
  })

  it("highlights selected option", () => {
    render(
      <StepEmployeeStatus
        value="new_needs_onboarding"
        onChange={vi.fn()}
      />,
    )
    const selectedButton = screen.getByText("É minha primeira vez aqui").closest("button")
    expect(selectedButton?.className).toContain("border-cerrado-600")
  })
})
