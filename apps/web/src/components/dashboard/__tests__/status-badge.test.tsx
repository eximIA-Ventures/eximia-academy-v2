import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusBadge } from "../status-badge"

describe("StatusBadge", () => {
  it("renders completed status with correct label", () => {
    render(<StatusBadge status="completed" />)
    expect(screen.getByText("Concluido")).toBeInTheDocument()
  })

  it("renders active status with correct label", () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText("Ativo")).toBeInTheDocument()
  })

  it("renders draft status", () => {
    render(<StatusBadge status="draft" />)
    expect(screen.getByText("Rascunho")).toBeInTheDocument()
  })

  it("renders published status", () => {
    render(<StatusBadge status="published" />)
    expect(screen.getByText("Publicado")).toBeInTheDocument()
  })

  it("renders archived status", () => {
    render(<StatusBadge status="archived" />)
    expect(screen.getByText("Arquivado")).toBeInTheDocument()
  })
})
