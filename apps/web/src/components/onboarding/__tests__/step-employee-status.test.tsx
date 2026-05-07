import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { StepEmployeeStatus } from "../step-employee-status"

describe("StepEmployeeStatus", () => {
  it("renders corporate title", () => {
    render(<StepEmployeeStatus onChange={vi.fn()} />)
    expect(screen.getByText("Você é novo na empresa?")).toBeInTheDocument()
  })

  it("renders 3 options", () => {
    render(<StepEmployeeStatus onChange={vi.fn()} />)
    expect(screen.getByText("Sou novo, preciso do onboarding")).toBeInTheDocument()
    expect(screen.getByText("Sou novo, mas já fiz o onboarding")).toBeInTheDocument()
    expect(screen.getByText("Já trabalho aqui há algum tempo")).toBeInTheDocument()
  })

  it("calls onChange with correct value when option clicked", () => {
    const onChange = vi.fn()
    render(<StepEmployeeStatus onChange={onChange} />)
    fireEvent.click(screen.getByText("Sou novo, preciso do onboarding"))
    expect(onChange).toHaveBeenCalledWith("new_needs_onboarding")
  })

  it("highlights selected option", () => {
    render(
      <StepEmployeeStatus
        value="new_needs_onboarding"
        onChange={vi.fn()}
      />,
    )
    const selectedButton = screen.getByText("Sou novo, preciso do onboarding").closest("button")
    expect(selectedButton?.className).toContain("border-cerrado-600")
  })
})
