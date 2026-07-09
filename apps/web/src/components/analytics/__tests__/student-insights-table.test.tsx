import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  type StudentInsightRow,
  StudentInsightsTable,
  buildManagerCsv,
} from "../student-insights-table"

let mockSearch = ""
const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush }),
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
        "Engajamento = interações concluídas x2 + reflexões. Interações acontecem ao final dos módulos; reflexões são registros ao longo dos slides.",
      ),
    ).toBeInTheDocument()
  })

  it("empty state colSpan matches variant (manager 5/6, with/without showSubteam — S12: base 5 sem Email)", () => {
    const { container: withoutSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" showSubteam={false} />,
    )
    expect(withoutSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("5")

    const { container: withSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" showSubteam={true} />,
    )
    expect(withSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("6")
  })
})

describe("StudentInsightsTable — coluna Ação / ponte para o Centro (E10)", () => {
  beforeEach(() => {
    mockSearch = ""
    mockPush.mockClear()
    // E10: a ponte navega (router.push); nada mais faz fetch a partir da
    // tabela. Stub explícito para provar que NENHUM POST direto acontece.
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

  it("E10: no_ritmo renders a clickable 'No ritmo' button that opens the positive menu (Ver detalhe / Parabenizar / Nada)", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Regular", triagem: "no_ritmo" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    const btn = screen.getByRole("button", { name: /Regular no ritmo/ })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)

    const menu = screen.getByRole("menu", { name: /Opções para Regular/ })
    expect(menu).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Ver detalhe" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Parabenizar" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Nada" })).toBeInTheDocument()
    // No POST direto a partir do "No ritmo".
    expect(fetch).not.toHaveBeenCalled()
  })

  it("gap D3: 'Ver detalhe' navega ao Centro focado no aluno (sem action); 'Parabenizar' navega com action=recognize (Sheet positivo); 'Nada' só fecha", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Regular", triagem: "no_ritmo" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Regular no ritmo/ }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver detalhe" }))
    expect(mockPush).toHaveBeenCalledWith("/engagement?student=s1")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Regular no ritmo/ }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Parabenizar" }))
    expect(mockPush).toHaveBeenLastCalledWith("/engagement?student=s1&action=recognize")

    fireEvent.click(screen.getByRole("button", { name: /Regular no ritmo/ }))
    mockPush.mockClear()
    fireEvent.click(screen.getByRole("menuitem", { name: "Nada" }))
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("E10: Escape closes the 'No ritmo' menu without navigating", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Regular", triagem: "no_ritmo" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Regular no ritmo/ }))
    expect(screen.getByRole("menu")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("AC2 (E10): 'Acionar' (atencao) navigates to /engagement?student&action=activate — no nudgeType, no fetch", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    expect(screen.getByText("Acionar")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Acionar Marcela no Centro de Engajamento" }),
    )

    expect(mockPush).toHaveBeenCalledWith("/engagement?student=s1&action=activate")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("AC3 (E10): 'Lembrar' (sem_acesso) navigates to /engagement?student&action=remind — no nudgeType, no fetch", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Sumiu", triagem: "sem_acesso" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    expect(screen.getByText("Lembrar")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Lembrar Sumiu no Centro de Engajamento" }))

    expect(mockPush).toHaveBeenCalledWith("/engagement?student=s1&action=remind")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("AC4 (E10): the URL never carries a nudgeType, regardless of totalSessions (derivation is server-side in E6/E3)", () => {
    render(
      <StudentInsightsTable
        students={[
          makeStudent({
            id: "s1",
            full_name: "Nunca Acessou",
            triagem: "atencao",
            totalSessions: 0,
          }),
          makeStudent({ id: "s2", full_name: "Sumiu", triagem: "atencao", totalSessions: 8 }),
        ]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Acionar Nunca Acessou no Centro de Engajamento" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Acionar Sumiu no Centro de Engajamento" }))

    for (const call of mockPush.mock.calls) {
      expect(String(call[0])).not.toMatch(/nudgeType|never_accessed|inactive|behind_teaching_plan/)
    }
    expect(mockPush).toHaveBeenNthCalledWith(1, "/engagement?student=s1&action=activate")
    expect(mockPush).toHaveBeenNthCalledWith(2, "/engagement?student=s2&action=activate")
  })

  it("AC12: colSpan factors in the Ação column (manager+canNudge: 7 with showSubteam, 6 without — S12: base 5 sem Email)", () => {
    const { container: withSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" canNudge={true} showSubteam={true} />,
    )
    expect(withSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("7")

    const { container: withoutSubteam } = render(
      <StudentInsightsTable students={[]} variant="manager" canNudge={true} showSubteam={false} />,
    )
    expect(withoutSubteam.querySelector("td[colspan]")?.getAttribute("colspan")).toBe("6")
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

  it("legacy/nudge endpoints are never called from the table (E10: the table only navigates)", () => {
    render(
      <StudentInsightsTable
        students={[makeStudent({ id: "s1", full_name: "Marcela", triagem: "atencao" })]}
        variant="manager"
        canNudge={true}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Acionar Marcela no Centro de Engajamento" }),
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("StudentInsightsTable — fidelidade visual ao mockup R3 (S12)", () => {
  beforeEach(() => {
    mockSearch = ""
  })

  it("D-2: manager variant has no Email header/cell (email becomes title on name); instructor keeps Email", () => {
    const students = [makeStudent({ id: "s1", full_name: "Aluno Email", email: "x@y.com" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.queryByText("Email")).not.toBeInTheDocument()
    expect(screen.queryByText("x@y.com")).not.toBeInTheDocument()
    expect(screen.getByText("Aluno Email")).toHaveAttribute("title", "x@y.com")
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("x@y.com")).toBeInTheDocument()
  })

  it("manager search placeholder is 'Buscar aluno'; instructor keeps the longer placeholder", () => {
    const students = [makeStudent({ id: "s1" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.getByPlaceholderText("Buscar aluno")).toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.getByPlaceholderText("Buscar por nome ou email...")).toBeInTheDocument()
  })

  it("manager engagement column: score 0 shows 'Inativo' + 'Nenhuma atividade recente'; score > 0 shows interações/reflexões by extenso", () => {
    const students = [
      makeStudent({ id: "s1", full_name: "Zero", completedSessions: 0, reflectionsCount: 0 }),
      makeStudent({ id: "s2", full_name: "Ativo", completedSessions: 3, reflectionsCount: 5 }),
    ]
    render(<StudentInsightsTable students={students} variant="manager" />)

    expect(screen.getByText("Inativo")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma atividade recente")).toBeInTheDocument()
    expect(screen.getByText("3 interações · 5 reflexões")).toBeInTheDocument()
  })

  it("instructor engagement column keeps the abbreviated 'sess'/'refl' badge/text (unchanged)", () => {
    const students = [
      makeStudent({ id: "s1", full_name: "Zero", completedSessions: 0, reflectionsCount: 0 }),
      makeStudent({ id: "s2", full_name: "Ativo", completedSessions: 3, reflectionsCount: 5 }),
    ]
    render(<StudentInsightsTable students={students} />)

    expect(screen.getByText("Inativo")).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma atividade recente")).not.toBeInTheDocument()
    expect(screen.getByText("3 sess · 5 refl")).toBeInTheDocument()
  })

  it("manager 'Ação' column renders solid buttons: 'No ritmo' opens the positive menu, 'Lembrar' and 'Acionar' bridge to the Centro (E10)", () => {
    const students = [
      makeStudent({ id: "s1", full_name: "Regular", triagem: "no_ritmo" }),
      makeStudent({ id: "s2", full_name: "Marcela", triagem: "atencao" }),
      makeStudent({ id: "s3", full_name: "Sumiu", triagem: "sem_acesso" }),
    ]
    render(<StudentInsightsTable students={students} variant="manager" canNudge={true} />)

    // E10: "No ritmo" agora é um botão clicável (abre menu), não uma badge morta.
    expect(screen.getByRole("button", { name: /Regular no ritmo/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Acionar Marcela no Centro de Engajamento" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lembrar Sumiu no Centro de Engajamento" }),
    ).toBeInTheDocument()
  })

  it("mockup headers: manager shows 'Progresso'/'Engaj.', instructor keeps 'Progressão'/'Engajamento'", () => {
    const students = [makeStudent({ id: "s1" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.getByText("Progresso")).toBeInTheDocument()
    expect(screen.getByText("Engaj.")).toBeInTheDocument()
    expect(screen.queryByText("Progressão")).not.toBeInTheDocument()
    expect(screen.queryByText("Engajamento")).not.toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.getByText("Progressão")).toBeInTheDocument()
    expect(screen.getByText("Engajamento")).toBeInTheDocument()
    expect(screen.queryByText("Progresso")).not.toBeInTheDocument()
    expect(screen.queryByText("Engaj.")).not.toBeInTheDocument()
  })

  it("card title/subtitle: manager shows 'Tabela simplificada' + subtítulo, instructor keeps 'Detalhes dos Alunos' with no subtítulo", () => {
    const students = [makeStudent({ id: "s1" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.getByText("Tabela simplificada")).toBeInTheDocument()
    expect(
      screen.getByText("A tabela vira apoio para investigação individual."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Detalhes dos Alunos")).not.toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.getByText("Detalhes dos Alunos")).toBeInTheDocument()
    expect(
      screen.queryByText("A tabela vira apoio para investigação individual."),
    ).not.toBeInTheDocument()
  })

  it("D-3: 'Exportar' button only in manager variant", () => {
    const students = [makeStudent({ id: "s1" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.queryByRole("button", { name: "Exportar" })).not.toBeInTheDocument()
  })

  it("no 'Detalhe futuro' footer note in ANY variant (não anunciar features futuras; detalhe é instrutor/admin-only, decisão Hugo 2026-07-07)", () => {
    const students = [makeStudent({ id: "s1" })]

    const { unmount } = render(<StudentInsightsTable students={students} variant="manager" />)
    expect(screen.queryByText(/Detalhe futuro/)).not.toBeInTheDocument()
    unmount()

    render(<StudentInsightsTable students={students} />)
    expect(screen.queryByText(/Detalhe futuro/)).not.toBeInTheDocument()
  })
})

describe("buildManagerCsv (S12, D-3)", () => {
  it("header row matches manager columns, with Time only when showSubteam", () => {
    expect(buildManagerCsv([], false).split("\n")[0]).toBe(
      "Nome,Último acesso,Ritmo,Progresso,Engajamento,Interações concluídas,Reflexões,Ação",
    )
    expect(buildManagerCsv([], true).split("\n")[0]).toBe(
      "Nome,Time,Último acesso,Ritmo,Progresso,Engajamento,Interações concluídas,Reflexões,Ação",
    )
  })

  it("derives Ritmo label, Ação label (from triagem), and engagement score per row", () => {
    const rows: StudentInsightRow[] = [
      makeStudent({
        id: "s1",
        full_name: "No Ritmo",
        ritmo: "no_ritmo",
        triagem: "no_ritmo",
        completedSessions: 4,
        reflectionsCount: 2,
        courseProgressPct: 80,
      }),
      makeStudent({
        id: "s2",
        full_name: "Atencao",
        ritmo: "atrasado",
        triagem: "atencao",
        totalSessions: 3,
      }),
      makeStudent({
        id: "s3",
        full_name: "SemAcesso",
        triagem: "sem_acesso",
        totalSessions: 0,
      }),
    ]
    const lines = buildManagerCsv(rows, false).split("\n")

    expect(lines[1]).toBe("No Ritmo,Nunca,No ritmo,80%,10,4,2,No ritmo")
    expect(lines[2]).toBe("Atencao,Nunca,Atrasado,0%,0,0,0,Acionar")
    expect(lines[3]).toBe("SemAcesso,Nunca,-,0%,0,0,0,Lembrar")
  })

  it("escapes commas, quotes and newlines per CSV rules", () => {
    const rows: StudentInsightRow[] = [makeStudent({ id: "s1", full_name: 'Alu"no, X' })]
    const lines = buildManagerCsv(rows, false).split("\n")
    expect(lines[1].startsWith('"Alu""no, X"')).toBe(true)
  })

  it("includes Time cell with subteam path when showSubteam, 'Direto' otherwise", () => {
    const rows: StudentInsightRow[] = [
      makeStudent({
        id: "s1",
        full_name: "Com Time",
        subteam: { id: TEAM_A, name: "Time A", path: ["Time A"] },
      }),
      makeStudent({ id: "s2", full_name: "Sem Time" }),
    ]
    const lines = buildManagerCsv(rows, true).split("\n")
    expect(lines[1].startsWith("Com Time,Time A,")).toBe(true)
    expect(lines[2].startsWith("Sem Time,Direto,")).toBe(true)
  })
})
