import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FormField } from "../components/form-field"

describe("FormField", () => {
  it("renders label text", () => {
    render(
      <FormField label="Email">
        <input />
      </FormField>,
    )
    expect(screen.getByText("Email")).toBeInTheDocument()
  })

  it("renders children (form control)", () => {
    render(
      <FormField label="Email">
        <input data-testid="input" />
      </FormField>,
    )
    expect(screen.getByTestId("input")).toBeInTheDocument()
  })

  it("shows error message when error prop provided", () => {
    render(
      <FormField label="Email" error="Invalid email">
        <input />
      </FormField>,
    )
    expect(screen.getByText("Invalid email")).toBeInTheDocument()
  })

  it("error message has role='alert'", () => {
    render(
      <FormField label="Email" error="Required">
        <input />
      </FormField>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Required")
  })

  it("does not show error when no error prop", () => {
    render(
      <FormField label="Email">
        <input />
      </FormField>,
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("passes required to Label (shows asterisk)", () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    )
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  it("passes disabled to Label", () => {
    render(
      <FormField label="Email" disabled data-testid="field">
        <input />
      </FormField>,
    )
    const label = screen.getByText("Email").closest("label")
    expect(label?.className).toContain("opacity-40")
  })

  it("merges custom className on wrapper", () => {
    render(
      <FormField label="Email" className="custom-field" data-testid="field">
        <input />
      </FormField>,
    )
    expect(screen.getByTestId("field").className).toContain("custom-field")
  })

  it("forwards ref", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>
    render(
      <FormField ref={ref} label="Email">
        <input />
      </FormField>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it("has zero hardcoded color values", () => {
    render(
      <FormField label="Email" error="Bad" data-testid="field">
        <input />
      </FormField>,
    )
    const fieldClasses = screen.getByTestId("field").className
    const errorClasses = screen.getByRole("alert").className
    const allClasses = `${fieldClasses} ${errorClasses}`
    expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(allClasses).not.toMatch(/rgba?\(/)
  })
})
