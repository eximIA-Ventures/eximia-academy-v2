import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RadioGroup, RadioItem } from "../components/radio"

describe("Radio", () => {
  it('RadioGroup renders with role="radiogroup"', () => {
    render(
      <RadioGroup>
        <RadioItem value="a">A</RadioItem>
      </RadioGroup>,
    )
    expect(screen.getByRole("radiogroup")).toBeInTheDocument()
  })

  it('RadioItem renders with role="radio"', () => {
    render(
      <RadioGroup>
        <RadioItem value="a">Option A</RadioItem>
      </RadioGroup>,
    )
    expect(screen.getByRole("radio")).toBeInTheDocument()
  })

  it("selecting RadioItem calls onValueChange", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <RadioGroup onValueChange={onValueChange}>
        <RadioItem value="a">A</RadioItem>
        <RadioItem value="b">B</RadioItem>
      </RadioGroup>,
    )
    await user.click(screen.getByText("B"))
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("selected item has aria-checked true", () => {
    render(
      <RadioGroup value="a">
        <RadioItem value="a">A</RadioItem>
        <RadioItem value="b">B</RadioItem>
      </RadioGroup>,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios[0]).toHaveAttribute("aria-checked", "true")
  })

  it("unselected items have aria-checked false", () => {
    render(
      <RadioGroup value="a">
        <RadioItem value="a">A</RadioItem>
        <RadioItem value="b">B</RadioItem>
      </RadioGroup>,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios[1]).toHaveAttribute("aria-checked", "false")
  })

  it("disabled group disables all items", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <RadioGroup disabled onValueChange={onValueChange}>
        <RadioItem value="a">A</RadioItem>
        <RadioItem value="b">B</RadioItem>
      </RadioGroup>,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios[0]).toBeDisabled()
    expect(radios[1]).toBeDisabled()
    await user.click(radios[0])
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("merges custom className", () => {
    render(
      <RadioGroup className="custom-group">
        <RadioItem value="a" className="custom-item">
          A
        </RadioItem>
      </RadioGroup>,
    )
    expect(screen.getByRole("radiogroup").className).toContain("custom-group")
    expect(screen.getByRole("radio").className).toContain("custom-item")
  })

  it("zero hardcoded color values", () => {
    render(
      <RadioGroup value="a">
        <RadioItem value="a">A</RadioItem>
      </RadioGroup>,
    )
    const radio = screen.getByRole("radio")
    const allClasses = radio.innerHTML + radio.className
    expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(allClasses).not.toMatch(/rgba?\(/)
  })
})
