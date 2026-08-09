import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CourseSwitcher } from "../course-switcher"

// JRN-D (correção Hugo 2026-07-24, ao vivo) — o seletor de curso da /jornada
// (construtor E dashboard) fica SEMPRE visível com 1+ curso. Antes a regra Krug
// `< 2` o escondia p/ o aluno de 1 matrícula (Rinaldo), que era exatamente o que
// o Hugo bateu no teste real. Some só com 0 cursos.

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

beforeEach(() => {
  push.mockClear()
})

const TWO = [
  { courseId: "c1", courseTitle: "Análise e Solução de Problemas" },
  { courseId: "c2", courseTitle: "Precificação" },
]

describe("CourseSwitcher — visibilidade por nº de cursos (JRN-D)", () => {
  it("aparece com 1 curso só (correção: caso Rinaldo, sempre visível)", () => {
    render(<CourseSwitcher options={[TWO[0]]} selectedCourseId="c1" />)
    const select = screen.getByLabelText("Trocar de curso") as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe("c1")
    expect(
      screen.getByRole("option", { name: "Análise e Solução de Problemas" }),
    ).toBeInTheDocument()
  })

  it("aparece com 2+ cursos e lista todos", () => {
    render(<CourseSwitcher options={TWO} selectedCourseId="c1" />)
    expect(screen.getByLabelText("Trocar de curso")).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Análise e Solução de Problemas" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Precificação" })).toBeInTheDocument()
  })

  it("NÃO aparece sem curso nenhum (options vazio)", () => {
    const { container } = render(<CourseSwitcher options={[]} selectedCourseId={null} />)
    expect(screen.queryByLabelText("Trocar de curso")).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it("trocar de curso navega para /jornada?curso=<courseId>", () => {
    render(<CourseSwitcher options={TWO} selectedCourseId="c1" />)
    fireEvent.change(screen.getByLabelText("Trocar de curso"), { target: { value: "c2" } })
    expect(push).toHaveBeenCalledWith("/jornada?curso=c2")
  })
})
