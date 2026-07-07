import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TeamFilterOption } from "../team-filter-dropdown"
import { TeamScopeControl, type TeamScopeControlProps } from "../team-scope-control"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(""),
}))

vi.mock("@/app/(platform)/context/actions", () => ({
  setTeamView: vi.fn(async () => undefined),
}))

const ROOT = "5a4d0000-0000-0000-0000-0000000000b1"
const BIA = "5a4d0000-0000-0000-0000-0000000000c1"

function renderControl(props: Partial<TeamScopeControlProps> = {}) {
  const baseProps: TeamScopeControlProps = {
    trail: [{ id: ROOT, fullName: "Rafael Norte" }],
    rootId: ROOT,
    rootLabel: "Meu Time",
    mode: "direct",
    isRoot: true,
    focusedLabel: "Meu Time",
  }

  return render(<TeamScopeControl {...baseProps} {...props} />)
}

describe("TeamScopeControl", () => {
  it("renders the reusable scope controls without dashboard data content", () => {
    renderControl()

    expect(screen.getByText("Recorte da equipe")).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Navegação da estrutura" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Diretos/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Hierarquia/ })).toBeInTheDocument()
    expect(screen.queryByText("Times abaixo")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Resumo de engajamento da equipe")).not.toBeInTheDocument()
  })

  // Pente fino Hugo (2026-07-07): na RAIZ o resumo dinâmico não renderiza
  // (a pill ativa já conta a história); num drill (!isRoot) ele diz DE QUEM
  // é o recorte.
  it.each([
    ["direct", "Bia Time-A", "Você está vendo os colaboradores diretos de Bia Time-A."],
    [
      "hierarchy",
      "Bia Time-A",
      "Diretos de Bia Time-A em destaque. Abaixo, todos os alunos dessa estrutura, por time.",
    ],
  ] satisfies Array<[TeamScopeControlProps["mode"], string, string]>)(
    "renders drill summary for mode %s when isRoot=false",
    (mode, focusedLabel, expected) => {
      renderControl({
        mode,
        isRoot: false,
        focusedLabel,
        trail: [
          { id: ROOT, fullName: "Rafael Norte" },
          { id: BIA, fullName: focusedLabel },
        ],
      })

      expect(screen.getByText(expected)).toBeInTheDocument()
    },
  )

  it.each(["direct", "hierarchy"] satisfies Array<TeamScopeControlProps["mode"]>)(
    "does NOT render a dynamic summary at root (mode %s)",
    (mode) => {
      renderControl({ mode, isRoot: true })
      expect(screen.queryByText(/Você está vendo/)).not.toBeInTheDocument()
      expect(screen.queryByText(/em destaque/)).not.toBeInTheDocument()
    },
  )

  // S6 (Onda 2): título forte do recorte + filtro de time elevado.
  const TEAM_A = "5a4d0000-0000-0000-0000-0000000000d1"
  const OPTIONS: TeamFilterOption[] = [
    { key: TEAM_A, label: "Time A", subteam: { id: TEAM_A, name: "Time A", colorIndex: 0 } },
    { key: "__direct__", label: "Direto" },
  ]

  it('renders the "Quem estou analisando?" title in both modes (AC1)', () => {
    renderControl({ mode: "direct" })
    expect(screen.getByRole("heading", { name: "Quem estou analisando?" })).toBeInTheDocument()

    renderControl({ mode: "hierarchy" })
    expect(screen.getAllByRole("heading", { name: "Quem estou analisando?" })).toHaveLength(2)
  })

  it("preserves eyebrow and the fixed subtitle alongside the new title (AC1)", () => {
    renderControl({ mode: "direct" })
    expect(screen.getByText("Recorte da equipe")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Defina se a leitura considera apenas diretos, toda a hierarquia ou um time específico.",
      ),
    ).toBeInTheDocument()
  })

  it("renders the team filter dropdown with mode=hierarchy + teamFilterOptions (AC2/AC3)", () => {
    renderControl({ mode: "hierarchy", teamFilterOptions: OPTIONS })
    expect(screen.getByRole("button", { name: "Filtrar por time" })).toBeInTheDocument()
  })

  it("does NOT render the dropdown with mode=direct, even with options (AC3)", () => {
    renderControl({ mode: "direct", teamFilterOptions: OPTIONS })
    expect(screen.queryByRole("button", { name: "Filtrar por time" })).not.toBeInTheDocument()
  })

  it("does NOT render the dropdown when teamFilterOptions is absent (non-root caller, AC3)", () => {
    renderControl({ mode: "hierarchy", teamFilterOptions: undefined })
    expect(screen.queryByRole("button", { name: "Filtrar por time" })).not.toBeInTheDocument()
  })
})
