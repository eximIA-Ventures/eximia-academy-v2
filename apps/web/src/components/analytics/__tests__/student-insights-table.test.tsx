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

describe("StudentInsightsTable — coluna Ação / nudge individual (S10)", () => {
  beforeEach(() => {
    mockSearch = ""
    vi.stubGlobal("fetch", vi.fn())
  })

  it("AC1: column absent without canNudge, and absent for instructor even with variant=manager forced by mistake", () => {
    const students = [makeStudent({ id: "s1", triagem: "atencao" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.queryByText("Ação")).not.toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} canNudge={true} />)
    expect(screen.queryByText("Ação")).not.toBeInTheDocument()
  })

  it("AC2: no_ritmo renders a static 'No ritmo' badge, no clickable element", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", triagem: "no_ritmo" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    expect(screen.getByText("No ritmo")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Enviar lembrete/ })).not.toBeInTheDocument()
  })

  it("AC3/AC9: atencao renders 'Lembrar' with aria-label, opens the confirm popover (dialog, focus on Cancelar) on click, no fetch yet (AC5)", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    const btn = screen.getByRole("button", { name: "Enviar lembrete para Marcela" })
    expect(screen.getByText("Lembrar")).toBeInTheDocument()
    fireEvent.click(btn)

    expect(fetch).not.toHaveBeenCalled()
    const dialog = screen.getByRole("dialog", { name: "Confirmar lembrete para Marcela" })
    expect(dialog).toBeInTheDocument()
    const normalized = dialog.textContent?.replace(/\s+/g, " ").trim()
    expect(normalized).toContain(
      "Enviar lembrete para Marcela? O aluno recebe uma notificação no app e por email.",
    )
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus()
  })

  it("AC4: sem_acesso renders 'Acionar'; nudgeType is never_accessed when totalSessions===0, inactive otherwise", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipientsSkipped: 0 }), { status: 200 }),
    )
    render(
      <StudentInsightsTable
        students={[
          makeStudent({
            id: "s1",
            full_name: "Nunca Acessou",
            triagem: "sem_acesso",
            totalSessions: 0,
          }),
          makeStudent({
            id: "s2",
            full_name: "Sumiu",
            triagem: "sem_acesso",
            totalSessions: 8,
          }),
        ]}
        variant="manager"
        canNudge={true}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Nunca Acessou" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findByText("Enviado")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/analytics/manager/nudge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ studentIds: ["s1"], nudgeType: "never_accessed" }),
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Sumiu" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findAllByText("Enviado")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/analytics/manager/nudge",
      expect.objectContaining({
        body: JSON.stringify({ studentIds: ["s2"], nudgeType: "inactive" }),
      }),
    )
  })

  it("AC5: Cancelar and Escape close the popover without any fetch", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("AC6: confirming a 'Lembrar' sends the exact body and flips to disabled 'Enviado' on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipientsSkipped: 0 }), { status: 200 }),
    )
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/analytics/manager/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: ["s1"], nudgeType: "inactive" }),
    })
    const sent = await screen.findByText("Enviado")
    expect(sent).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Enviar lembrete para Marcela" }),
    ).not.toBeInTheDocument()
  })

  it("AC7: non-ok response shows the error message and allows retry (button stays clickable)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    )
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await screen.findByText("Não foi possível enviar")
    expect(screen.getByRole("button", { name: "Enviar lembrete para Marcela" })).not.toBeDisabled()
  })

  it("AC7: recipientsSkipped > 0 also counts as failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipientsSkipped: 1 }), { status: 200 }),
    )
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await screen.findByText("Não foi possível enviar")
  })

  it("AC12: colSpan factors in the Ação column (manager+canNudge: 8 with showSubteam, 7 without)", () => {
    const { container: withSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" canNudge={true} showSubteam={true} />,
    )
    expect(withSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("8")

    const { container: withoutSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" canNudge={true} showSubteam={false} />,
    )
    expect(withoutSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("7")
  })

  it("AC10: triagem undefined renders a neutral placeholder without crashing", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Sem Triagem" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    expect(screen.getByText("Sem Triagem")).toBeInTheDocument()
    expect(screen.getByText("–")).toBeInTheDocument()
  })

  it("legacy endpoint /api/notifications/nudge is never called", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipientsSkipped: 0 }), { status: 200 }),
    )
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar lembrete para Marcela" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findByText("Enviado")

    for (const call of vi.mocked(fetch).mock.calls) {
      expect(String(call[0])).not.toBe("/api/notifications/nudge")
    }
  })
})
