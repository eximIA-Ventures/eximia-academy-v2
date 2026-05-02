import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Input } from "../components/input"

describe("Input", () => {
  it("renders with default props", () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument()
  })

  it("renders as an input element", () => {
    render(<Input data-testid="input" />)
    expect(screen.getByTestId("input").tagName).toBe("INPUT")
  })

  it("applies default size classes", () => {
    render(<Input data-testid="input" />)
    const input = screen.getByTestId("input")
    expect(input.className).toContain("h-11")
  })

  it("applies sm size classes", () => {
    render(<Input data-testid="input" inputSize="sm" />)
    const input = screen.getByTestId("input")
    expect(input.className).toContain("h-9")
  })

  it("applies lg size classes", () => {
    render(<Input data-testid="input" inputSize="lg" />)
    const input = screen.getByTestId("input")
    expect(input.className).toContain("h-12")
  })

  it("applies error state", () => {
    render(<Input data-testid="input" error />)
    const input = screen.getByTestId("input")
    expect(input.className).toContain("border-semantic-error")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })

  it("does not set aria-invalid when no error", () => {
    render(<Input data-testid="input" />)
    expect(screen.getByTestId("input")).not.toHaveAttribute("aria-invalid")
  })

  it("handles disabled state", () => {
    render(<Input data-testid="input" disabled />)
    expect(screen.getByTestId("input")).toBeDisabled()
  })

  it("accepts user input", async () => {
    const user = userEvent.setup()
    render(<Input data-testid="input" />)
    const input = screen.getByTestId("input")
    await user.type(input, "hello")
    expect(input).toHaveValue("hello")
  })

  it("calls onChange handler", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input data-testid="input" onChange={onChange} />)
    await user.type(screen.getByTestId("input"), "a")
    expect(onChange).toHaveBeenCalled()
  })

  it("supports different input types", () => {
    render(<Input data-testid="input" type="email" />)
    expect(screen.getByTestId("input")).toHaveAttribute("type", "email")
  })

  it("renders leading icon", () => {
    render(<Input leadingIcon={<span data-testid="icon">@</span>} data-testid="input" />)
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("renders trailing icon", () => {
    render(<Input trailingIcon={<span data-testid="icon">X</span>} data-testid="input" />)
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("adds padding for leading icon", () => {
    render(<Input leadingIcon={<span>@</span>} data-testid="input" />)
    expect(screen.getByTestId("input").className).toContain("pl-10")
  })

  it("adds padding for trailing icon", () => {
    render(<Input trailingIcon={<span>X</span>} data-testid="input" />)
    expect(screen.getByTestId("input").className).toContain("pr-10")
  })

  it("forwards ref", () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement | null>
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it("merges custom className", () => {
    render(<Input data-testid="input" className="custom-class" />)
    expect(screen.getByTestId("input").className).toContain("custom-class")
  })

  it("has zero hardcoded color values", () => {
    render(<Input data-testid="input" error />)
    const classes = screen.getByTestId("input").className
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(classes).not.toMatch(/rgba?\(/)
  })
})
