import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ColumnHelpPopover } from "../column-help-popover"

/**
 * Hugo (2026-07-31): "faça com que todos sejam clicáveis, e não hover".
 *
 * Hover não existe em toque — um gestor no celular nunca veria a explicação.
 * Estes testes garantem o comportamento de clique, o fechamento e a
 * exclusividade (só um aberto por vez).
 */

describe("ColumnHelpPopover", () => {
  it("começa fechado", () => {
    render(<ColumnHelpPopover text="Explicação do Percorrido" label="Percorrido" />)

    expect(screen.queryByText("Explicação do Percorrido")).not.toBeInTheDocument()
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")
  })

  it("abre ao CLICAR (não depende de hover)", () => {
    render(<ColumnHelpPopover text="Explicação do Percorrido" label="Percorrido" />)

    fireEvent.click(screen.getByRole("button"))

    expect(screen.getByText("Explicação do Percorrido")).toBeInTheDocument()
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
  })

  it("fecha ao clicar de novo no ícone", () => {
    render(<ColumnHelpPopover text="Texto" label="Percorrido" />)
    const btn = screen.getByRole("button")

    fireEvent.click(btn)
    expect(screen.getByText("Texto")).toBeInTheDocument()

    fireEvent.click(btn)
    expect(screen.queryByText("Texto")).not.toBeInTheDocument()
  })

  it("fecha ao clicar FORA", () => {
    render(
      <div>
        <ColumnHelpPopover text="Texto" label="Percorrido" />
        <span data-testid="fora">outro lugar</span>
      </div>,
    )

    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText("Texto")).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId("fora"))
    expect(screen.queryByText("Texto")).not.toBeInTheDocument()
  })

  it("fecha com Escape", () => {
    render(<ColumnHelpPopover text="Texto" label="Percorrido" />)

    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText("Texto")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByText("Texto")).not.toBeInTheDocument()
  })

  it("SÓ UM aberto por vez: abrir o segundo fecha o primeiro", () => {
    render(
      <div>
        <ColumnHelpPopover text="Ajuda do Percorrido" label="Percorrido" />
        <ColumnHelpPopover text="Ajuda do Progresso" label="Progresso" />
      </div>,
    )

    const [primeiro, segundo] = screen.getAllByRole("button")

    fireEvent.click(primeiro)
    expect(screen.getByText("Ajuda do Percorrido")).toBeInTheDocument()

    fireEvent.click(segundo)
    expect(screen.getByText("Ajuda do Progresso")).toBeInTheDocument()
    expect(screen.queryByText("Ajuda do Percorrido")).not.toBeInTheDocument()
  })

  it("o gatilho é um button de verdade, com rótulo acessível", () => {
    render(<ColumnHelpPopover text="Texto" label="Percorrido" />)

    const btn = screen.getByRole("button", { name: "Sobre a coluna Percorrido" })
    expect(btn).toHaveAttribute("type", "button")
  })
})
