import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
