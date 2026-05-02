import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "../components/badge"

describe("Badge", () => {
  it("renders with children text", () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("applies default variant", () => {
    render(<Badge data-testid="badge">Default</Badge>)
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("bg-white/10")
    expect(badge.className).toContain("text-text-secondary")
  })

  it("applies success variant class", () => {
    render(
      <Badge data-testid="badge" variant="success">
        Success
      </Badge>,
    )
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("bg-semantic-success/15")
    expect(badge.className).toContain("text-semantic-success")
  })

  it("applies warning variant class", () => {
    render(
      <Badge data-testid="badge" variant="warning">
        Warning
      </Badge>,
    )
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("bg-semantic-warning/15")
    expect(badge.className).toContain("text-semantic-warning")
  })

  it("applies error variant class", () => {
    render(
      <Badge data-testid="badge" variant="error">
        Error
      </Badge>,
    )
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("bg-semantic-error/15")
    expect(badge.className).toContain("text-semantic-error")
  })

  it("applies info variant class", () => {
    render(
      <Badge data-testid="badge" variant="info">
        Info
      </Badge>,
    )
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("bg-semantic-info/15")
    expect(badge.className).toContain("text-semantic-info")
  })

  it("applies sm size class", () => {
    render(
      <Badge data-testid="badge" badgeSize="sm">
        Small
      </Badge>,
    )
    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("text-2xs")
    expect(badge.className).toContain("px-2")
  })

  it("merges custom className", () => {
    render(
      <Badge data-testid="badge" className="custom-class">
        Custom
      </Badge>,
    )
    expect(screen.getByTestId("badge").className).toContain("custom-class")
  })

  it("has zero hardcoded color values in any variant", () => {
    const variants = [
      "default",
      "success",
      "warning",
      "error",
      "info",
      "draft",
      "archived",
    ] as const

    for (const variant of variants) {
      const { unmount } = render(
        <Badge data-testid="badge" variant={variant}>
          Test
        </Badge>,
      )
      const classes = screen.getByTestId("badge").className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
      unmount()
    }
  })
})
