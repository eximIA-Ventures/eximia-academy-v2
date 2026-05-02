import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentDashboard } from "../student-dashboard"

const mockData = {
  summary: { enrolledCourses: 2, completedSessions: 5, completedChapters: 3 },
  courses: [
    {
      courseId: "c1",
      title: "Curso de React",
      progress: 60,
      lastAccessedAt: new Date().toISOString(),
      continueChapterId: "ch1",
    },
  ],
  recentSessions: [
    {
      sessionId: "s1",
      chapterTitle: "Introducao",
      status: "completed" as const,
      completedAt: new Date().toISOString(),
    },
  ],
}

describe("StudentDashboard", () => {
  it("renders hero section with headline", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText(/Domine a era/)).toBeInTheDocument()
    expect(screen.getByText(/da inteligência/)).toBeInTheDocument()
  })

  it("renders CTA link to courses", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByRole("link", { name: "Iniciar Trilha" })).toHaveAttribute(
      "href",
      "/courses",
    )
  })

  it("renders eA assistant bar with default message", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("eA")).toBeInTheDocument()
    expect(
      screen.getByText("Sua proxima sessão esta pronta. Continuamos de onde paramos?"),
    ).toBeInTheDocument()
  })

  it("renders eA assistant bar with custom message", () => {
    const dataWithMessage = { ...mockData, dudMessage: "Mensagem personalizada" }
    render(<StudentDashboard fullName="Hugo Capitelli" data={dataWithMessage} />)

    expect(screen.getByText("Mensagem personalizada")).toBeInTheDocument()
  })

  it("renders 4 content cards", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("TRILHAS")).toBeInTheDocument()
    expect(screen.getByText("LIVES")).toBeInTheDocument()
    expect(screen.getByText("BIBLIOTECA")).toBeInTheDocument()
    expect(screen.getByText("MATERIAIS")).toBeInTheDocument()
  })

  it("renders card descriptions with executive language", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Programas estruturados de desenvolvimento")).toBeInTheDocument()
    expect(screen.getByText("Sessões ao vivo com especialistas")).toBeInTheDocument()
    expect(screen.getByText("Curadoria de conteúdo essencial")).toBeInTheDocument()
    expect(screen.getByText("Frameworks, templates e referencias")).toBeInTheDocument()
  })

  it("renders NOVOS badge on Biblioteca card", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("NOVOS")).toBeInTheDocument()
  })
})
