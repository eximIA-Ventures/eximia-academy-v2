import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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

  it.each([
    ["direct", true, "Meu Time", "Você está vendo seus colaboradores diretos."],
    [
      "hierarchy",
      true,
      "Meu Time",
      "Você está vendo o agregado de toda a estrutura abaixo de você.",
    ],
    ["direct", false, "Bia Time-A", "Filtrado pelos membros diretos de Bia Time-A."],
    ["hierarchy", false, "Bia Time-A", "Filtrado pela estrutura inteira abaixo de Bia Time-A."],
  ] satisfies Array<[TeamScopeControlProps["mode"], boolean, string, string]>)(
    "renders summary for mode %s and isRoot %s",
    (mode, isRoot, focusedLabel, expected) => {
      renderControl({
        mode,
        isRoot,
        focusedLabel,
        trail: isRoot
          ? [{ id: ROOT, fullName: "Rafael Norte" }]
          : [
              { id: ROOT, fullName: "Rafael Norte" },
              { id: BIA, fullName: focusedLabel },
            ],
      })

      expect(screen.getByText(expected)).toBeInTheDocument()
    },
  )
})
