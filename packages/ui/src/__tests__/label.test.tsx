import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Label } from "../components/label"

describe("Label", () => {
  it("renders with text content", () => {
    render(<Label>Email</Label>)
    expect(screen.getByText("Email")).toBeInTheDocument()
  })

  it("renders as label element", () => {
    render(<Label data-testid="label">Name</Label>)
    expect(screen.getByTestId("label").tagName).toBe("LABEL")
  })

  it("applies text-sm class", () => {
    render(<Label data-testid="label">Name</Label>)
    expect(screen.getByTestId("label").className).toContain("text-sm")
  })

  it("shows asterisk when required", () => {
    render(<Label required>Email</Label>)
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  it("applies disabled styling", () => {
    render(
      <Label data-testid="label" disabled>
        Name
      </Label>,
    )
    const label = screen.getByTestId("label")
    expect(label.className).toContain("opacity-40")
    expect(label.className).toContain("cursor-not-allowed")
  })

  it("associates with input via htmlFor", () => {
    render(<Label htmlFor="email-input">Email</Label>)
    expect(screen.getByText("Email")).toHaveAttribute("for", "email-input")
  })

  it("merges custom className", () => {
    render(
      <Label data-testid="label" className="custom-class">
        Name
      </Label>,
    )
    expect(screen.getByTestId("label").className).toContain("custom-class")
  })

  it("forwards ref", () => {
    const ref = { current: null } as React.RefObject<HTMLLabelElement | null>
    render(<Label ref={ref}>Name</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })
})
