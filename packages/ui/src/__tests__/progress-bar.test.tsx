import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProgressBar } from "../components/progress-bar"

describe("ProgressBar", () => {
  it("renders with default props", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("sets correct width style based on value", () => {
    render(<ProgressBar value={75} />)
    const progressbar = screen.getByRole("progressbar")
    const fill = progressbar.firstChild as HTMLElement
    expect(fill.style.width).toBe("75%")
  })

  it("has role='progressbar'", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("has correct aria-valuenow", () => {
    render(<ProgressBar value={60} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60")
  })

  it("has correct aria-valuemin and aria-valuemax", () => {
    render(<ProgressBar value={50} max={200} />)
    const progressbar = screen.getByRole("progressbar")
    expect(progressbar).toHaveAttribute("aria-valuemin", "0")
    expect(progressbar).toHaveAttribute("aria-valuemax", "200")
  })

  it("applies size variants (sm)", () => {
    render(<ProgressBar value={50} size="sm" />)
    const progressbar = screen.getByRole("progressbar")
    expect(progressbar.className).toContain("h-1")
  })

  it("applies size variants (md)", () => {
    render(<ProgressBar value={50} size="md" />)
    const progressbar = screen.getByRole("progressbar")
    expect(progressbar.className).toContain("h-2")
  })

  it("applies size variants (lg)", () => {
    render(<ProgressBar value={50} size="lg" />)
    const progressbar = screen.getByRole("progressbar")
    expect(progressbar.className).toContain("h-3")
  })

  it("applies color variants (default)", () => {
    render(<ProgressBar value={50} />)
    const progressbar = screen.getByRole("progressbar")
    const fill = progressbar.firstChild as HTMLElement
    expect(fill.className).toContain("bg-accent-blue-mid")
  })

  it("applies color variants (success)", () => {
    render(<ProgressBar value={50} variant="success" />)
    const progressbar = screen.getByRole("progressbar")
    const fill = progressbar.firstChild as HTMLElement
    expect(fill.className).toContain("bg-semantic-success")
  })

  it("applies color variants (warning)", () => {
    render(<ProgressBar value={50} variant="warning" />)
    const progressbar = screen.getByRole("progressbar")
    const fill = progressbar.firstChild as HTMLElement
    expect(fill.className).toContain("bg-semantic-warning")
  })

  it("shows label when provided", () => {
    render(<ProgressBar value={50} label="Progress" />)
    expect(screen.getByText("Progress")).toBeInTheDocument()
  })

  it("shows percentage when showValue=true", () => {
    render(<ProgressBar value={75} showValue />)
    expect(screen.getByText("75%")).toBeInTheDocument()
  })

  it("clamps value between 0 and max", () => {
    const { rerender } = render(<ProgressBar value={150} />)
    let progressbar = screen.getByRole("progressbar")
    expect(progressbar).toHaveAttribute("aria-valuenow", "100")
    let fill = progressbar.firstChild as HTMLElement
    expect(fill.style.width).toBe("100%")

    rerender(<ProgressBar value={-20} />)
    progressbar = screen.getByRole("progressbar")
    expect(progressbar).toHaveAttribute("aria-valuenow", "0")
    fill = progressbar.firstChild as HTMLElement
    expect(fill.style.width).toBe("0%")
  })

  it("has zero hardcoded color values", () => {
    const variants = ["default", "success", "warning"] as const
    for (const variant of variants) {
      const { unmount } = render(<ProgressBar value={50} variant={variant} />)
      const progressbar = screen.getByRole("progressbar")
      const fill = progressbar.firstChild as HTMLElement
      const allClasses = `${progressbar.className} ${fill.className}`
      expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(allClasses).not.toMatch(/rgba?\(/)
      unmount()
    }
  })
})
