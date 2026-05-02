import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EmptyState } from "../empty-state"

describe("EmptyState", () => {
  const props = {
    title: "Você ainda nao esta inscrito em nenhum curso.",
    description: "Explore os cursos disponiveis e comece sua jornada.",
    action: { label: "Explorar Cursos", href: "/courses" },
  }

  it("renders title and description", () => {
    render(<EmptyState {...props} />)

    expect(screen.getByText(props.title)).toBeInTheDocument()
    expect(screen.getByText(props.description)).toBeInTheDocument()
  })

  it("renders CTA button with correct href", () => {
    render(<EmptyState {...props} />)

    const link = screen.getByRole("link", { name: "Explorar Cursos" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/courses")
  })
})
