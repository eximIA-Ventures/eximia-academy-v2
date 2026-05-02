import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Skeleton } from "../components/skeleton"

describe("Skeleton", () => {
  it("renders a div", () => {
    render(<Skeleton data-testid="skeleton" />)
    const el = screen.getByTestId("skeleton")
    expect(el.tagName).toBe("DIV")
  })

  it("has animate-pulse class", () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId("skeleton").className).toContain("animate-pulse")
  })

  it("has bg-bg-elevated class", () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId("skeleton").className).toContain("bg-bg-elevated")
  })

  it("has rounded-md class", () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId("skeleton").className).toContain("rounded-md")
  })

  it("merges custom className", () => {
    render(<Skeleton data-testid="skeleton" className="w-full h-4" />)
    const classes = screen.getByTestId("skeleton").className
    expect(classes).toContain("w-full")
    expect(classes).toContain("h-4")
  })

  it("forwards ref", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>
    render(<Skeleton ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it("has zero hardcoded color values", () => {
    render(<Skeleton data-testid="skeleton" className="w-full h-8 rounded-full" />)
    const classes = screen.getByTestId("skeleton").className
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(classes).not.toMatch(/rgba?\(/)
  })
})
