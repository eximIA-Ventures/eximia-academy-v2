import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// A LIGAÇÃO entre o modelo de visão e a tela (CFG-3.1, AC1 e AC6).
//
// O `job-roles-view-model.test.ts` prova as REGRAS; este arquivo prova que elas
// chegaram na tela: que o colapso realmente sobrevive a desmontar e montar de
// novo (é isso que "persiste entre navegações" significa em React), que o grupo
// sem match some de fato do DOM, e que o drawer abre com os blocos que o AC6
// enumera.
//
// A paridade visual (motion de abertura, espaçamento, hierarquia) NÃO é provada
// aqui de propósito: por decisão do @sm ao aplicar F5, ela é gate humano do
// dono contra o mockup, e um assert de classe CSS só daria a ilusão de tê-la.
// =============================================================================

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

// As server actions são o limite deste teste: aqui interessa o que a tela
// MOSTRA, não o que o banco faz (isso está em `delete-job-role.test.ts`).
vi.mock("../actions", () => ({
  createJobRole: vi.fn(async () => ({ data: { id: "new" } })),
  updateJobRole: vi.fn(async () => ({ success: true })),
  duplicateJobRole: vi.fn(async () => ({ data: { id: "dup" } })),
  deleteJobRoleWithReassignment: vi.fn(async () => ({ success: true })),
  reassignJobRolePeople: vi.fn(async () => ({ success: true })),
  linkTrailToJobRole: vi.fn(async () => ({ success: true })),
  unlinkTrailFromJobRole: vi.fn(async () => ({ success: true })),
}))

const { JobRolesClient } = await import("../job-roles-client")
import type { JobRoleWithStats } from "../types"

/* -------------------------------- Fixtures -------------------------------- */

const VENDEDOR: JobRoleWithStats = {
  id: "jr-vend",
  name: "Vendedor Interno",
  slug: "vendedor-interno",
  description: "Atende o balcão e fecha pedidos",
  seniority_level: "junior",
  area_id: "area-com",
  area_name: "Comercial",
  created_at: "2026-01-01",
  active_trails_count: 1,
  trails: [{ id: "t-2", title: "Técnicas de Venda", status: "active" }],
  people: [
    {
      id: "u-1",
      full_name: "Carlos Eduardo Silva",
      email: "carlos@cory.com.br",
      area_names: ["Ribeirão Preto"],
    },
  ],
}

const CONFERENTE: JobRoleWithStats = {
  id: "jr-conf",
  name: "Conferente",
  slug: "conferente",
  description: "Confere carga na expedição",
  seniority_level: "mid",
  area_id: "area-log",
  area_name: "Logística",
  created_at: "2026-01-02",
  active_trails_count: 0,
  trails: [],
  people: [],
}

const AREAS = [
  { id: "area-com", name: "Comercial" },
  { id: "area-log", name: "Logística" },
]

const TRAILS = [
  { id: "t-2", title: "Técnicas de Venda", status: "active", target_job_role_id: "jr-vend" },
  { id: "t-9", title: "Segurança do Trabalho", status: "active", target_job_role_id: null },
]

function renderList() {
  return render(<JobRolesClient roles={[VENDEDOR, CONFERENTE]} areas={AREAS} trails={TRAILS} />)
}

beforeEach(() => {
  // `localStorage` próprio e determinístico: a persistência é o objeto do teste.
  let store: Record<string, string> = {}
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
      key: () => null,
      length: 0,
    },
  })
  refresh.mockClear()
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC1 — grupos colapsáveis com memória", () => {
  it("colapsar um grupo esconde suas linhas e o estado volta na montagem seguinte", () => {
    const first = renderList()

    expect(screen.getByTestId("job-role-row-jr-vend")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Comercial/ }))
    expect(screen.queryByTestId("job-role-row-jr-vend")).not.toBeInTheDocument()
    // O outro grupo não foi junto: o colapso é individual.
    expect(screen.getByTestId("job-role-row-jr-conf")).toBeInTheDocument()

    // "Entre navegações": desmontar e montar de novo é o que acontece ao sair
    // da tela de Cargos e voltar.
    first.unmount()
    renderList()

    expect(screen.queryByTestId("job-role-row-jr-vend")).not.toBeInTheDocument()
    expect(screen.getByTestId("job-role-row-jr-conf")).toBeInTheDocument()
  })

  it("o cabeçalho do grupo mostra a contagem real de cargos e pessoas", () => {
    renderList()
    expect(screen.getByText("1 cargo · 1 pessoa")).toBeInTheDocument()
    expect(screen.getByText("1 cargo · 0 pessoas")).toBeInTheDocument()
  })

  it("grupo sem nenhum cargo correspondente à busca some da lista", () => {
    renderList()

    fireEvent.change(screen.getByLabelText("Buscar cargo"), { target: { value: "venda" } })

    // "venda" casa Vendedor Interno pela TRILHA "Técnicas de Venda" (AC2).
    expect(screen.getByTestId("group-area-com")).toBeInTheDocument()
    expect(screen.queryByTestId("group-area-log")).not.toBeInTheDocument()
  })
})

describe("AC5 — a linha mostra o que a versão anterior escondia", () => {
  it("nome de trilha, pessoas e o dot de governança com explicação", () => {
    renderList()

    const row = screen.getByTestId("job-role-row-jr-vend")
    expect(within(row).getByText("Técnicas de Venda")).toBeInTheDocument()
    expect(within(row).getByTitle("Atende o balcão e fecha pedidos")).toBeInTheDocument()

    const flagged = screen.getByTestId("job-role-row-jr-conf")
    expect(
      within(flagged).getByLabelText("Sem trilha ativa e sem pessoas vinculadas"),
    ).toBeInTheDocument()
  })
})

describe("AC6/AC7 — o drawer abre com os blocos exigidos", () => {
  it("clicar na linha abre o painel do cargo com cabeçalho, trilhas, pessoas, sugestões e ações", () => {
    renderList()

    fireEvent.click(screen.getByTestId("job-role-row-jr-vend"))

    const drawer = screen.getByTestId("job-role-drawer")
    expect(within(drawer).getByTestId("drawer-header")).toBeInTheDocument()
    expect(within(drawer).getByTestId("drawer-description")).toBeInTheDocument()
    expect(within(drawer).getByTestId("drawer-trails")).toBeInTheDocument()
    expect(within(drawer).getByTestId("drawer-people")).toBeInTheDocument()
    expect(within(drawer).getByTestId("drawer-suggestions")).toBeInTheDocument()
    expect(within(drawer).getByTestId("drawer-actions")).toBeInTheDocument()

    // O conteúdo é do cargo clicado, com dado REAL: trilha por nome e pessoa.
    expect(within(drawer).getByText("Técnicas de Venda")).toBeInTheDocument()
    expect(within(drawer).getByText("Carlos Eduardo Silva")).toBeInTheDocument()

    const actions = within(drawer).getByTestId("drawer-actions")
    for (const label of ["Editar", "Duplicar", "Excluir", "Fechar"]) {
      expect(within(actions).getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it('"Mover pessoas de cargo…" pede destino explícito por pessoa', () => {
    renderList()
    fireEvent.click(screen.getByTestId("job-role-row-jr-vend"))

    fireEvent.click(screen.getByRole("button", { name: /Mover pessoas de cargo/ }))

    const fields = screen.getByTestId("reassign-people-fields")
    const select = within(fields).getByLabelText("Destino de Carlos Eduardo Silva")
    expect(within(select as HTMLSelectElement).getByText("Fica sem cargo")).toBeInTheDocument()
    // Enquanto ninguém tem destino, confirmar fica indisponível.
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled()
  })

  it('"Novo cargo" abre o MESMO drawer em modo criação, sem blocos que ainda não existem', () => {
    renderList()

    fireEvent.click(screen.getByRole("button", { name: /Novo cargo/ }))

    const drawer = screen.getByTestId("job-role-drawer")
    expect(within(drawer).getByLabelText("Nome do cargo")).toBeInTheDocument()
    expect(within(drawer).queryByTestId("drawer-people")).not.toBeInTheDocument()
    expect(within(drawer).getByRole("button", { name: "Criar cargo" })).toBeInTheDocument()
  })
})

describe("AC4 — stats clicáveis viram recorte, e o chip limpa", () => {
  it('clicar em "Cargos sem trilha" filtra e oferece o chip removível', () => {
    renderList()

    fireEvent.click(screen.getByRole("button", { name: /Cargos sem trilha/ }))

    expect(screen.queryByTestId("job-role-row-jr-vend")).not.toBeInTheDocument()
    expect(screen.getByTestId("job-role-row-jr-conf")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }))
    expect(screen.getByTestId("job-role-row-jr-vend")).toBeInTheDocument()
  })
})
