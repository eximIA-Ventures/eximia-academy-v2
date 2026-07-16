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
      whenLabel: "ontem",
    },
  ],
  nextStep: {
    chapterId: "ch1",
    chapterTitle: "Diagrama de Ishikawa",
    courseId: "c1",
    courseTitle: "Curso de React",
  },
  weeklyPlan: {
    goal: 3,
    days: [0, 1, 2, 4],
    reminder: { enabled: true, time: "08h" },
  },
  weekDays: [
    { dow: "Seg", state: "done" as const, task: "Introducao" },
    { dow: "Ter", state: "missed" as const, task: "Em aberto" },
    { dow: "Qua", state: "today" as const, task: "Diagrama de Ishikawa" },
    { dow: "Qui", state: "rest" as const, task: "Descanso" },
    { dow: "Sex", state: "scheduled" as const, task: "Sessão planejada" },
    { dow: "Sáb", state: "rest" as const, task: "Descanso" },
    { dow: "Dom", state: "rest" as const, task: "Descanso" },
  ],
  sessionsThisWeek: 1,
  streakDays: 3,
  journey: {
    bandIndex: 2,
    bandLabel: "No ritmo",
    progressPct: 60,
    pctToNextBand: 10,
    nextBandLabel: "Adiantado",
    distribution: [
      { label: "Iniciando", pct: 12, isYou: false },
      { label: "Em movimento", pct: 35, isYou: false },
      { label: "No ritmo", pct: 40, isYou: true },
      { label: "Adiantado", pct: 10, isYou: false },
      { label: "Concluído", pct: 3, isYou: false },
    ],
  },
}

describe("StudentDashboard", () => {
  it("renders hero section with greeting", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Ola, Hugo.")).toBeInTheDocument()
  })

  it("renders provocative next step card with activation question", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(
      screen.getByText("O que você vai aplicar desta vez no seu trabalho real?"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Diagrama de Ishikawa · Curso de React/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Continuar agora/ })).toHaveAttribute(
      "href",
      "/courses/c1/chapters/ch1",
    )
    expect(screen.getByRole("button", { name: "Responder depois" })).toBeInTheDocument()
  })

  it("renders weekly plan card with goal, streak and reminder footer", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Meu plano da semana")).toBeInTheDocument()
    expect(screen.getByText(/esta semana/)).toBeInTheDocument()
    expect(screen.getByText(/3 dias no ritmo/)).toBeInTheDocument()
    expect(screen.getByText(/Lembretes por e-mail ativados às 08h/)).toBeInTheDocument()
    expect(screen.getByText("Feito")).toBeInTheDocument()
    expect(screen.getByText("Hoje")).toBeInTheDocument()
    expect(screen.getByText("Agendado")).toBeInTheDocument()
  })

  it("renders weekly plan empty state when no plan is saved", () => {
    render(
      <StudentDashboard
        fullName="Hugo Capitelli"
        data={{ ...mockData, weeklyPlan: null, weekDays: [] }}
      />,
    )

    expect(screen.getByRole("button", { name: "Montar meu plano" })).toBeInTheDocument()
  })

  it("renders journey position card with bands and no-ranking principle", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Minha posição na jornada")).toBeInTheDocument()
    expect(screen.getByText("Você")).toBeInTheDocument()
    expect(screen.getByText("Faixas · sem ranking")).toBeInTheDocument()
    expect(screen.getByText("No ritmo · você")).toBeInTheDocument()
    expect(
      screen.getByText("A comparação é sempre por faixa, nunca por posição individual."),
    ).toBeInTheDocument()
  })

  it("omits class distribution when aggregation is unavailable", () => {
    render(
      <StudentDashboard
        fullName="Hugo Capitelli"
        data={{ ...mockData, journey: { ...mockData.journey, distribution: null } }}
      />,
    )

    expect(screen.queryByText("Distribuição da turma")).not.toBeInTheDocument()
    expect(screen.getByText("Minha posição na jornada")).toBeInTheDocument()
  })

  it("renders recent activities card with relative time", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Atividades recentes")).toBeInTheDocument()
    expect(screen.getByText(/Concluiu "Introducao"/)).toBeInTheDocument()
    expect(screen.getByText("ontem")).toBeInTheDocument()
  })

  it("renders 4 content cards", () => {
    render(<StudentDashboard fullName="Hugo Capitelli" data={mockData} />)

    expect(screen.getByText("Trilhas")).toBeInTheDocument()
    expect(screen.getByText("Lives")).toBeInTheDocument()
    expect(screen.getByText("Biblioteca")).toBeInTheDocument()
    expect(screen.getByText("Materiais")).toBeInTheDocument()
  })
})
