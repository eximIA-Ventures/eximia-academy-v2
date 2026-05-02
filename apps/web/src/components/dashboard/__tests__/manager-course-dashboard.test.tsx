import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ManagerCourseDashboard } from "../manager-course-dashboard"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const mockData = {
  summary: { totalCourses: 3, totalStudents: 45, sessionsThisWeek: 12 },
  courses: [
    {
      courseId: "c1",
      title: "React",
      studentCount: 20,
      completionRate: 65,
      sessionCount: 80,
      status: "published",
    },
  ],
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe("ManagerCourseDashboard", () => {
  it("renders welcome banner and summary cards with corporate labels", () => {
    render(
      <Wrapper>
        <ManagerCourseDashboard fullName="Maria Santos" data={mockData} aiDetectionEnabled={false} />
      </Wrapper>,
    )

    expect(screen.getByText(/Ola, Maria!/)).toBeInTheDocument()
    expect(screen.getByText("Total de Cursos e Trilhas")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("Total de Alunos")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("Sessões esta Semana")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("shows empty state when manager has no courses", () => {
    const emptyData = {
      summary: { totalCourses: 0, totalStudents: 0, sessionsThisWeek: 0 },
      courses: [],
    }

    render(
      <Wrapper>
        <ManagerCourseDashboard fullName="Maria Santos" data={emptyData} aiDetectionEnabled={false} />
      </Wrapper>,
    )

    expect(screen.getByText("Você ainda nao criou nenhum curso.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Criar Curso" })).toHaveAttribute(
      "href",
      "/courses/new",
    )
  })
})
