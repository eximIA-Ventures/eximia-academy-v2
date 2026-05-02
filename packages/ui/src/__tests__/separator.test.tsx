import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Separator } from "../components/separator"

describe("Separator", () => {
  it("renders horizontal by default", () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId("sep")
    expect(sep.className).toContain("h-px")
    expect(sep.className).toContain("w-full")
  })

  it("renders vertical when orientation='vertical'", () => {
    render(<Separator data-testid="sep" orientation="vertical" />)
    const sep = screen.getByTestId("sep")
    expect(sep.className).toContain("h-full")
    expect(sep.className).toContain("w-px")
  })

  it("has role='separator' by default", () => {
    render(<Separator data-testid="sep" />)
    expect(screen.getByTestId("sep")).toHaveAttribute("role", "separator")
  })

  it("has role='none' when decorative", () => {
    render(<Separator data-testid="sep" decorative />)
    expect(screen.getByTestId("sep")).toHaveAttribute("role", "none")
  })

  it("applies correct aria-orientation", () => {
    const { rerender } = render(<Separator data-testid="sep" />)
    expect(screen.getByTestId("sep")).toHaveAttribute("aria-orientation", "horizontal")

    rerender(<Separator data-testid="sep" orientation="vertical" />)
    expect(screen.getByTestId("sep")).toHaveAttribute("aria-orientation", "vertical")
  })

  it("merges custom className", () => {
    render(<Separator data-testid="sep" className="custom-class" />)
    expect(screen.getByTestId("sep").className).toContain("custom-class")
  })
})
