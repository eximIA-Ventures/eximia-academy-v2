import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Textarea } from "../components/textarea"

describe("Textarea", () => {
  it("renders as textarea element", () => {
    render(<Textarea data-testid="textarea" />)
    expect(screen.getByTestId("textarea").tagName).toBe("TEXTAREA")
  })

  it("applies bg-bg-card class", () => {
    render(<Textarea data-testid="textarea" />)
    expect(screen.getByTestId("textarea").className).toContain("bg-bg-card")
  })

  it("applies error state classes", () => {
    render(<Textarea data-testid="textarea" error />)
    const textarea = screen.getByTestId("textarea")
    expect(textarea.className).toContain("border-semantic-error")
  })

  it("sets aria-invalid when error", () => {
    render(<Textarea data-testid="textarea" error />)
    expect(screen.getByTestId("textarea")).toHaveAttribute("aria-invalid", "true")
  })

  it("handles disabled state", () => {
    render(<Textarea data-testid="textarea" disabled />)
    expect(screen.getByTestId("textarea")).toBeDisabled()
  })

  it("accepts user input", async () => {
    const user = userEvent.setup()
    render(<Textarea data-testid="textarea" />)
    const textarea = screen.getByTestId("textarea")
    await user.type(textarea, "hello world")
    expect(textarea).toHaveValue("hello world")
  })

  it("merges custom className", () => {
    render(<Textarea data-testid="textarea" className="custom-class" />)
    expect(screen.getByTestId("textarea").className).toContain("custom-class")
  })

  it("forwards ref", () => {
    const ref = { current: null } as React.RefObject<HTMLTextAreaElement | null>
    render(<Textarea ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it("zero hardcoded color values", () => {
    render(<Textarea data-testid="textarea" error />)
    const classes = screen.getByTestId("textarea").className
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(classes).not.toMatch(/rgba?\(/)
  })
})
