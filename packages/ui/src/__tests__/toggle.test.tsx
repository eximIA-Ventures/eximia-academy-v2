import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Toggle } from "../components/toggle"

describe("Toggle", () => {
  it('renders with role="switch"', () => {
    render(<Toggle />)
    expect(screen.getByRole("switch")).toBeInTheDocument()
  })

  it("shows unchecked state by default", () => {
    render(<Toggle />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false")
  })

  it("shows checked state when checked=true", () => {
    render(<Toggle checked />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("calls onCheckedChange when clicked", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Toggle onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole("switch"))
    expect(onCheckedChange).toHaveBeenCalledOnce()
  })

  it("toggles from false to true on click", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Toggle checked={false} onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole("switch"))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("has aria-checked attribute", () => {
    render(<Toggle checked={true} />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("is disabled when disabled prop is true", () => {
    render(<Toggle disabled />)
    expect(screen.getByRole("switch")).toBeDisabled()
  })

  it("does not call onCheckedChange when disabled", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Toggle disabled onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole("switch"))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("merges custom className", () => {
    render(<Toggle className="custom-class" />)
    expect(screen.getByRole("switch").className).toContain("custom-class")
  })

  it("zero hardcoded color values", () => {
    render(<Toggle checked />)
    const classes = screen.getByRole("switch").className
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(classes).not.toMatch(/rgba?\(/)
  })
})
