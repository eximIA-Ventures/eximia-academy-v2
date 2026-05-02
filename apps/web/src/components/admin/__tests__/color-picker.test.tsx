import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ColorPicker } from "../color-picker"

describe("ColorPicker", () => {
  it("renders label and initial value", () => {
    render(<ColorPicker label="Cor Primaria" value="#2a6ab0" onChange={vi.fn()} />)

    expect(screen.getByText("Cor Primaria")).toBeInTheDocument()
    // Both color input and text input share value; use getAllByDisplayValue
    const inputs = screen.getAllByDisplayValue("#2a6ab0")
    expect(inputs.length).toBe(2)
  })

  it("calls onChange with valid hex color", () => {
    const onChange = vi.fn()
    render(<ColorPicker label="Cor" value="#000000" onChange={onChange} />)

    // Target the text input (maxLength attribute distinguishes it)
    const textInput = screen.getByPlaceholderText("#000000")
    fireEvent.change(textInput, { target: { value: "#ff0000" } })

    expect(onChange).toHaveBeenCalledWith("#ff0000")
  })

  it("shows error for invalid hex value", () => {
    render(<ColorPicker label="Cor" value="#000000" onChange={vi.fn()} />)

    const textInput = screen.getByPlaceholderText("#000000")
    fireEvent.change(textInput, { target: { value: "#gggggg" } })

    expect(screen.getByText("Formato inválido. Use #RRGGBB")).toBeInTheDocument()
  })

  it("does not show error for partial input", () => {
    render(<ColorPicker label="Cor" value="#000000" onChange={vi.fn()} />)

    const textInput = screen.getByPlaceholderText("#000000")
    fireEvent.change(textInput, { target: { value: "#ff" } })

    expect(screen.queryByText("Formato inválido. Use #RRGGBB")).not.toBeInTheDocument()
  })

  it("renders color input with aria-label", () => {
    render(<ColorPicker label="Cor Primaria" value="#2a6ab0" onChange={vi.fn()} />)

    expect(screen.getByLabelText("Selecionar Cor Primaria")).toBeInTheDocument()
  })
})
