import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type StudentInsightRow, StudentInsightsTable } from "../student-insights-table"

let mockSearch = ""

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

const TEAM_A = "5a4d0000-0000-0000-0000-0000000000e1"
const TEAM_B = "5a4d0000-0000-0000-0000-0000000000e2"

function makeStudent(overrides: Partial<StudentInsightRow>): StudentInsightRow {
  return {
    id: overrides.id ?? "student-x",
    full_name: overrides.full_name ?? "Aluno X",
    email: overrides.email ?? "aluno@example.com",
    lastSessionDate: null,
    totalSessions: 0,
    completedSessions: 0,
    coursesEnrolled: 0,
    coursesCompleted: 0,
    reflectionsCount: 0,
    ...overrides,
  }
}

const STUDENTS: StudentInsightRow[] = [
  makeStudent({
    id: "s1",
    full_name: "Aluna Time A",
    subteam: { id: TEAM_A, name: "Time A", colorIndex: 0 },
  }),
  makeStudent({
    id: "s2",
    full_name: "Aluno Time B",
    subteam: { id: TEAM_B, name: "Time B", colorIndex: 1 },
  }),
  makeStudent({ id: "s3", full_name: "Aluno Direto" }),
]

describe("StudentInsightsTable — filtro de time URL-backed (S6)", () => {
  it("filters to only the selected team's rows via ?teams=<idA>", () => {
    mockSearch = `teams=${TEAM_A}`
    render(<StudentInsightsTable students={STUDENTS} showSubteam />)

    expect(screen.getByText("Aluna Time A")).toBeInTheDocument()
    expect(screen.queryByText("Aluno Time B")).not.toBeInTheDocument()
    expect(screen.queryByText("Aluno Direto")).not.toBeInTheDocument()
  })

  it("shows all rows when ?teams= holds an unknown/stale id (AC7, never traps the table empty)", () => {
    mockSearch = "teams=unknown-stale-id"
    render(<StudentInsightsTable students={STUDENTS} showSubteam />)

    expect(screen.getByText("Aluna Time A")).toBeInTheDocument()
    expect(screen.getByText("Aluno Time B")).toBeInTheDocument()
    expect(screen.getByText("Aluno Direto")).toBeInTheDocument()
  })

  it("instructor view (rows without subteam) hides the funnel and ignores ?teams= (AC6)", () => {
    // Mirrors instructor/page.tsx: rows never carry `subteam` at all, so
    // teamOptions collapses to a single "Direto" entry and effectiveTeams
    // for ANY ?teams= value is structurally empty (no matching option key) —
    // the same safety net as AC7, not a showSubteam branch in the filter.
    const instructorRows: StudentInsightRow[] = [
      makeStudent({ id: "s1", full_name: "Aluna Time A" }),
      makeStudent({ id: "s2", full_name: "Aluno Time B" }),
      makeStudent({ id: "s3", full_name: "Aluno Direto" }),
    ]
    mockSearch = `teams=${TEAM_A}`
    render(<StudentInsightsTable students={instructorRows} showSubteam={false} />)

    expect(screen.queryByRole("button", { name: "Filtrar por time" })).not.toBeInTheDocument()
    expect(screen.getByText("Aluna Time A")).toBeInTheDocument()
    expect(screen.getByText("Aluno Time B")).toBeInTheDocument()
    expect(screen.getByText("Aluno Direto")).toBeInTheDocument()
  })
})

describe("StudentInsightsTable — variant manager (S9)", () => {
  beforeEach(() => {
    mockSearch = ""
  })

  const STUDENT_WITH_RAW_CONTENT: StudentInsightRow = makeStudent({
    id: "s1",
    full_name: "Aluno Com Conteúdo",
    ritmo: "atrasado",
    recentSessions: [
      {
        chapterTitle: "Cap 1",
        status: "completed",
        createdAt: "2026-01-01T00:00:00.000Z",
        studentMessages: ["mensagem bruta do aluno"],
      },
    ],
    recentReflections: [
      {
        slideOrder: 1,
        chapterTitle: "Cap 1",
        response: "reflexão bruta do aluno",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })

  it("LGPD hard guard (AC7): variant=manager NEVER expands nor links, even with expandable={true} forced", () => {
    const { container } = render(
      <StudentInsightsTable
        students={[STUDENT_WITH_RAW_CONTENT]}
        variant="manager"
        expandable={true}
      />,
    )

    expect(container.querySelector("svg.lucide-chevron-right")).toBeNull()
    expect(container.querySelector("svg.lucide-chevron-down")).toBeNull()
    expect(screen.queryByRole("button", { name: "Aluno Com Conteúdo" })).not.toBeInTheDocument()
    expect(screen.getByText("Aluno Com Conteúdo").tagName).toBe("SPAN")
    expect(screen.queryByText("Ver perfil completo")).not.toBeInTheDocument()
    expect(container.querySelector('a[href^="/analytics/students/"]')).toBeNull()
  })

  it("manager variant hides Sessões and Cursos headers, shows Ritmo with badges by value", () => {
    const students: StudentInsightRow[] = [
      makeStudent({ id: "s1", full_name: "Joana Regular", ritmo: "no_ritmo" }),
      makeStudent({ id: "s2", full_name: "Carlos Devendo", ritmo: "atrasado" }),
      makeStudent({ id: "s3", full_name: "Marina Zero", ritmo: "nao_iniciado" }),
      makeStudent({ id: "s4", full_name: "Pedro Indefinido" }),
    ]
    render(<StudentInsightsTable students={students} variant="manager" />)

    expect(screen.queryByText("Sessões")).not.toBeInTheDocument()
    expect(screen.queryByText("Cursos")).not.toBeInTheDocument()
    expect(screen.getByText("Ritmo")).toBeInTheDocument()
    expect(screen.getByText("No ritmo")).toBeInTheDocument()
    expect(screen.getByText("Atrasado")).toBeInTheDocument()
    expect(screen.getByText("Não iniciado")).toBeInTheDocument()
    expect(screen.getByText("-")).toBeInTheDocument()
  })

  it("first click on Ritmo header sorts asc: atrasado, nao_iniciado, no_ritmo, then unset", () => {
    const students: StudentInsightRow[] = [
      makeStudent({ id: "s1", full_name: "Zeta Regular", ritmo: "no_ritmo" }),
      makeStudent({ id: "s2", full_name: "Alfa Indefinido" }),
      makeStudent({ id: "s3", full_name: "Beta Devendo", ritmo: "atrasado" }),
      makeStudent({ id: "s4", full_name: "Gama Zerado", ritmo: "nao_iniciado" }),
    ]
    const { container } = render(<StudentInsightsTable students={students} variant="manager" />)

    fireEvent.click(screen.getByRole("button", { name: /Ritmo/ }))

    const names = [...container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector("td")?.textContent,
    )
    expect(names).toEqual(["Beta Devendo", "Gama Zerado", "Zeta Regular", "Alfa Indefinido"])
  })

  it("instructor default (no variant) is unchanged: Sessões/Cursos present, name is a button, profile link on expand", () => {
    render(<StudentInsightsTable students={[STUDENT_WITH_RAW_CONTENT]} />)

    expect(screen.getByText("Sessões")).toBeInTheDocument()
    expect(screen.getByText("Cursos")).toBeInTheDocument()
    expect(screen.queryByText("Ritmo")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aluno Com Conteúdo" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Aluno Com Conteúdo" }))
    expect(screen.getByText(/Ver perfil completo/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Ver perfil completo/ }).getAttribute("href")).toBe(
      `/analytics/students/${STUDENT_WITH_RAW_CONTENT.id}`,
    )
  })

  it("engagement header explains the score via aria-label", () => {
    render(<StudentInsightsTable students={[makeStudent({ id: "s1" })]} variant="manager" />)

    expect(
      screen.getByLabelText(
        "Engajamento = sessões concluídas x2 + reflexões. Sessões são interações ao final dos módulos; reflexões são registros ao longo dos slides.",
      ),
    ).toBeInTheDocument()
  })

  it("empty state colSpan matches variant (manager 6/7, with/without showSubteam)", () => {
    const { container: withoutSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" showSubteam={false} />,
    )
    expect(withoutSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("6")

    const { container: withSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" showSubteam={true} />,
    )
    expect(withSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("7")
  })
})
