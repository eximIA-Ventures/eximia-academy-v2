import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}))

import { ManagerDashboard } from "../manager-dashboard"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const mockData = {
  summary: {
    activeStudents: 120,
    engagementRate: 75,
    completionRate: 60,
    sessionsThisMonth: 450,
  },
  engagementChart: [
    { week: "2026-01-05", sessions: 40 },
    { week: "2026-01-12", sessions: 55 },
  ],
  courseTable: [
    {
      courseId: "c1",
      title: "React Pro",
      studentCount: 50,
      completionRate: 65,
      avgReflectionDepth: 4.2,
      avgAiDetection: 90,
    },
  ],
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe("ManagerDashboard", () => {
  it("renders summary cards with corporate labels", () => {
    render(
      <Wrapper>
        <ManagerDashboard
          fullName="Carlos Silva"
          data={mockData}
          aiDetectionEnabled={false}
          courses={[]}
        />
      </Wrapper>,
    )

    // Labels reais dos 4 KPI cards genéricos (genericKpisBlock em
    // manager-dashboard.tsx): Cursos, Sessões Concluídas, Alunos Ativos,
    // Engajamento. "Competencias Ativas"/"ROI de Treinamento"/"Sessões este
    // Mês" nunca existiram no componente — teste desatualizado.
    expect(screen.getByText(/Olá, Carlos!/)).toBeInTheDocument()
    expect(screen.getByText("Alunos Ativos")).toBeInTheDocument()
    expect(screen.getByText("120")).toBeInTheDocument()
    expect(screen.getByText("Sessões Concluídas")).toBeInTheDocument()
    expect(screen.getByText("450")).toBeInTheDocument()
    expect(screen.getByText("Engajamento")).toBeInTheDocument()
    expect(screen.getByText("75%")).toBeInTheDocument()
  })

  it("renders course analytics table", () => {
    render(
      <Wrapper>
        <ManagerDashboard
          fullName="Carlos Silva"
          data={mockData}
          aiDetectionEnabled={true}
          courses={[]}
        />
      </Wrapper>,
    )

    expect(screen.getByText("React Pro")).toBeInTheDocument()
    expect(screen.getByText("AI Detection (%)")).toBeInTheDocument()
  })
})
