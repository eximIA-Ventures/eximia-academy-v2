import type { StudentInsightRow } from "@/components/analytics/student-insights-table"
import type { TriageSummary } from "@/lib/student-triage"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ManagerDashboard } from "../manager-dashboard"
import type { ManagerAnalytics } from "../types"

// Mocks LEVES dos blocos filhos: renderizam só um marcador textual, para o
// teste ser de ORDEM (funil de decisão), não de conteúdo (propriedade de
// S7/S8/S9/S10). SummaryCards não é mockado — os itens de cada bloco (cards
// de triagem vs. KPIs genéricos) já têm labels distintos suficientes para
// servirem de marcador.
vi.mock("@/components/analytics/student-insights-table", () => ({
  StudentInsightsTable: () => <div>MARKER_TABELA</div>,
}))
vi.mock("../manager-dashboard-client", () => ({
  ManagerDashboardClient: () => <div>MARKER_ANALYTICS</div>,
}))

const mockData: ManagerAnalytics = {
  summary: { activeStudents: 10, engagementRate: 50, completionRate: 40, sessionsThisMonth: 30 },
  engagementChart: [],
  courseTable: [],
}

const triageSummary: TriageSummary = {
  analisados: 6,
  noRitmo: 3,
  atencao: 1,
  semAcesso: 2,
  noRitmoPct: 50,
  atencaoPct: 17,
  semAcessoPct: 33,
}

const studentDetails: StudentInsightRow[] = [
  {
    id: "s1",
    full_name: "Aluno Um",
    email: "aluno@example.com",
    lastSessionDate: null,
    totalSessions: 0,
    completedSessions: 0,
    coursesEnrolled: 0,
    coursesCompleted: 0,
    reflectionsCount: 0,
  },
]

/** Ordena os marcadores pelo índice em que aparecem no texto renderizado. */
function domOrder(container: HTMLElement, markers: string[]): string[] {
  const text = container.textContent ?? ""
  return [...markers].sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

const RECORTE_MARKER = "MARKER_RECORTE"
const HEADING = "Área de investigação individual: depois do cenário geral, verifique cada aluno."

describe("ManagerDashboard — funil de decisão (S11)", () => {
  it("visão team ordena: recorte, cards de triagem, destaques, heading+tabela, analytics, quick actions, socrático", () => {
    const { container } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        socraticKpis={{ avgDepth: 4, totalBreakthroughs: 2 }}
        studentDetails={studentDetails}
        triageSummary={triageSummary}
        teamRecortePanel={<div>{RECORTE_MARKER}</div>}
        teachingPlanHighlights={<div>MARKER_DESTAQUES</div>}
      />,
    )

    const order = domOrder(container, [
      RECORTE_MARKER,
      "Alunos analisados", // card de triagem (S7)
      "MARKER_DESTAQUES",
      HEADING,
      "MARKER_TABELA",
      "MARKER_ANALYTICS",
      "Gerenciar conteúdo", // quick action "Cursos" (desc única, evita colisão com o KPI card "Cursos")
      "Motor Socrático",
    ])

    expect(order).toEqual([
      RECORTE_MARKER,
      "Alunos analisados",
      "MARKER_DESTAQUES",
      HEADING,
      "MARKER_TABELA",
      "MARKER_ANALYTICS",
      "Gerenciar conteúdo",
      "Motor Socrático",
    ])
    // Os KPIs genéricos NÃO aparecem quando triageSummary está presente (E4).
    expect(container.textContent).not.toContain("Alunos Ativos")
  })

  it("visão team SEM triageSummary usa os SummaryCards genéricos na posição 3 (fallback)", () => {
    const { container } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        studentDetails={studentDetails}
        teamRecortePanel={<div>{RECORTE_MARKER}</div>}
        teachingPlanHighlights={<div>MARKER_DESTAQUES</div>}
      />,
    )

    const order = domOrder(container, [RECORTE_MARKER, "Alunos Ativos", "MARKER_DESTAQUES"])
    expect(order).toEqual([RECORTE_MARKER, "Alunos Ativos", "MARKER_DESTAQUES"])
    expect(container.textContent).not.toContain("Alunos analisados")
  })

  it("visão admin/unidade (sem teamRecortePanel) preserva a ordem legada e não mostra o heading da S11", () => {
    const { container } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        socraticKpis={{ avgDepth: 4, totalBreakthroughs: 2 }}
        studentDetails={studentDetails}
        teachingPlanHighlights={<div>MARKER_DESTAQUES</div>}
      />,
    )

    const order = domOrder(container, [
      "MARKER_DESTAQUES",
      "Alunos Ativos", // KPIs genéricos
      "Gerenciar conteúdo", // quick action
      "Motor Socrático",
      "MARKER_ANALYTICS",
      "MARKER_TABELA",
    ])
    expect(order).toEqual([
      "MARKER_DESTAQUES",
      "Alunos Ativos",
      "Gerenciar conteúdo",
      "Motor Socrático",
      "MARKER_ANALYTICS",
      "MARKER_TABELA",
    ])
    expect(container.textContent).not.toContain(HEADING)
    expect(container.textContent).not.toContain(RECORTE_MARKER)
  })

  it("heading de investigação individual só existe na visão team, e só quando há tabela (AC7)", () => {
    const { container: adminContainer } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        studentDetails={studentDetails}
      />,
    )
    expect(adminContainer.textContent).not.toContain(HEADING)

    const { container: teamNoTableContainer } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        studentDetails={[]}
        teamRecortePanel={<div>{RECORTE_MARKER}</div>}
      />,
    )
    expect(teamNoTableContainer.textContent).not.toContain(HEADING)
    expect(teamNoTableContainer.textContent).not.toContain("MARKER_TABELA")

    const { container: teamWithTableContainer } = render(
      <ManagerDashboard
        fullName="Rinaldo Gestor"
        data={mockData}
        aiDetectionEnabled={false}
        courses={[]}
        studentDetails={studentDetails}
        teamRecortePanel={<div>{RECORTE_MARKER}</div>}
      />,
    )
    expect(teamWithTableContainer.textContent).toContain(HEADING)
  })
})
