import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it } from "vitest"
import { Select } from "../components/select"

describe("Select", () => {
  it("renders as select element", () => {
    render(
      <Select aria-label="test">
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("renders options as children", () => {
    render(
      <Select aria-label="test">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    )
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("applies default size", () => {
    render(
      <Select aria-label="test">
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox").className).toContain("h-11")
  })

  it("applies sm size", () => {
    render(
      <Select aria-label="test" selectSize="sm">
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox").className).toContain("h-9")
  })

  it("applies lg size", () => {
    render(
      <Select aria-label="test" selectSize="lg">
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox").className).toContain("h-12")
  })

  it("applies error state", () => {
    render(
      <Select aria-label="test" error>
        <option value="a">A</option>
      </Select>,
    )
    const select = screen.getByRole("combobox")
    expect(select.className).toContain("border-semantic-error")
    expect(select).toHaveAttribute("aria-invalid", "true")
  })

  it("disabled state", () => {
    render(
      <Select aria-label="test" disabled>
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("forwards ref", () => {
    const ref = createRef<HTMLSelectElement>()
    render(
      <Select ref={ref} aria-label="test">
        <option value="a">A</option>
      </Select>,
    )
    expect(ref.current).toBeInstanceOf(HTMLSelectElement)
  })

  it("merges custom className", () => {
    render(
      <Select aria-label="test" className="custom-class">
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByRole("combobox").className).toContain("custom-class")
  })

  it("zero hardcoded color values", () => {
    render(
      <Select aria-label="test" error>
        <option value="a">A</option>
      </Select>,
    )
    const select = screen.getByRole("combobox")
    const allClasses = select.className
    expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(allClasses).not.toMatch(/rgba?\(/)
  })
})
