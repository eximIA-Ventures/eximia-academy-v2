import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Checkbox } from "../components/checkbox"

describe("Checkbox", () => {
  it('renders with role="checkbox"', () => {
    render(<Checkbox />)
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("aria-checked false by default", () => {
    render(<Checkbox />)
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false")
  })

  it("aria-checked true when checked", () => {
    render(<Checkbox checked />)
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true")
  })

  it("calls onCheckedChange on click", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole("checkbox"))
    expect(onCheckedChange).toHaveBeenCalledOnce()
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("disabled prevents onCheckedChange", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox disabled onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole("checkbox"))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("renders label text as children", () => {
    render(<Checkbox>Accept terms</Checkbox>)
    expect(screen.getByText("Accept terms")).toBeInTheDocument()
  })

  it("merges custom className", () => {
    render(<Checkbox className="custom-class" />)
    expect(screen.getByRole("checkbox").className).toContain("custom-class")
  })

  it("zero hardcoded color values", () => {
    render(<Checkbox checked />)
    const el = screen.getByRole("checkbox")
    const allClasses = el.innerHTML + el.className
    expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(allClasses).not.toMatch(/rgba?\(/)
  })
})
