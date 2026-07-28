import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { UserList } from "../user-list"

// Mock window.confirm
vi.stubGlobal(
  "confirm",
  vi.fn(() => true),
)

const orgFields = { reports_to: null, job_role_id: null, superior_name: null }

const mockUsers = [
  {
    ...orgFields,
    id: "u1",
    full_name: "Hugo Capitelli",
    email: "hugo@test.com",
    role: "admin",
    status: "active",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-02-01T00:00:00Z",
  },
  {
    ...orgFields,
    id: "u2",
    full_name: "Maria Santos",
    email: "maria@test.com",
    role: "student",
    status: "active",
    avatar_url: null,
    created_at: "2026-01-15T00:00:00Z",
    last_sign_in_at: null,
  },
  {
    ...orgFields,
    id: "u3",
    full_name: null,
    email: "john@test.com",
    role: "manager",
    status: "inactive",
    avatar_url: null,
    created_at: "2026-01-20T00:00:00Z",
    last_sign_in_at: null,
  },
]

describe("UserList", () => {
  it("renders table headers", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Nome")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Role")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Ultimo Login")).toBeInTheDocument()
  })

  it("renders user data in table rows", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Hugo Capitelli")).toBeInTheDocument()
    expect(screen.getByText("hugo@test.com")).toBeInTheDocument()
    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.getByText("maria@test.com")).toBeInTheDocument()
  })

  it("renders em dash for null full_name", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    // u3 has null full_name, shown as "—"
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it("renders active/inactive status badges", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    const activeBadges = screen.getAllByText("Ativo")
    expect(activeBadges).toHaveLength(2)
    expect(screen.getByText("Inativo")).toBeInTheDocument()
  })

  it("shows empty state when no users", () => {
    render(<UserList initialData={[]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Nenhum usuário encontrado.")).toBeInTheDocument()
  })

  // ---- CFG-2.2 — a pílula deixa de ser binária -----------------------------

  it("mostra 'Convite pendente' para quem foi convidado e nunca aceitou", () => {
    const convidado = {
      ...orgFields,
      id: "u4",
      full_name: "Convidado Recente",
      email: "convidado@test.com",
      role: "student",
      // A linha nasce `status: 'active'` no convite — é exatamente por isso que
      // a pílula não pode ser lida da coluna.
      status: "active",
      avatar_url: null,
      created_at: "2026-07-27T00:00:00Z",
      last_sign_in_at: null,
      invited_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      confirmed_at: null,
    }

    render(<UserList initialData={[convidado]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Convite pendente")).toBeInTheDocument()
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument()
  })

  it("mostra 'Convite expirado' quando o convite passou do prazo", () => {
    const antigo = {
      ...orgFields,
      id: "u5",
      full_name: "Convidado Antigo",
      email: "antigo@test.com",
      role: "student",
      status: "active",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: null,
      invited_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      confirmed_at: null,
    }

    render(<UserList initialData={[antigo]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Convite expirado")).toBeInTheDocument()
  })

  it("sem os fatos do Auth (AC9), a pílula volta ao par binário", () => {
    // `mockUsers` não tem invited_at/confirmed_at — é o mapa vazio do accessor.
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.getAllByText("Ativo")).toHaveLength(2)
    expect(screen.getByText("Inativo")).toBeInTheDocument()
    expect(screen.queryByText("Convite pendente")).not.toBeInTheDocument()
  })

  it("shows load more button when cursor exists", () => {
    render(<UserList initialData={mockUsers} initialCursor="cursor123" currentUserId="u1" />)

    expect(screen.getByText("Carregar mais")).toBeInTheDocument()
  })

  it("hides load more button when no cursor", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.queryByText("Carregar mais")).not.toBeInTheDocument()
  })
})

// ===========================================================================
// CFG-6.1 — Cargo e Área como colunas, ⋯ por estado, e "Mover de área".
// ===========================================================================

const AREAS = [
  { id: "area-rp", name: "Ribeirão Preto" },
  { id: "area-mg", name: "Minas Gerais" },
]

/* ------------------------- Mock de `fetch` tipado ------------------------- */

interface RecordedCall {
  url: string
  init: RequestInit
}

/**
 * Stub de `fetch` que registra as chamadas e só entrega uma delas por
 * `callAt(i)`.
 *
 * Por que não ler `fetchMock.mock.calls[0][0]` direto: com `vi.fn(() => ...)` o
 * TypeScript infere a tupla de argumentos como `[]`, e indexá-la quebra o `tsc`
 * do app inteiro com `TS2493`. As saídas fáceis (`!`, `as any`) apagariam o
 * sintoma e, pior, deixariam um teste que estoura com `TypeError` obscuro quando
 * a chamada esperada simplesmente não acontece.
 *
 * `callAt` resolve as duas coisas de uma vez: ele AFIRMA que a chamada ocorreu
 * — que é o que o teste deveria provar antes de olhar o argumento — e devolve
 * um tipo exato, sem cast e sem encadeamento opcional.
 */
function stubFetch(response: { ok: boolean; body?: unknown }) {
  const calls: RecordedCall[] = []

  const mock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return { ok: response.ok, json: async () => response.body ?? {} }
  })

  vi.stubGlobal("fetch", mock)

  return {
    mock,
    callAt(index: number): RecordedCall {
      const call = calls[index]
      if (!call) {
        throw new Error(
          `esperava ao menos ${index + 1} chamada(s) a fetch, mas houve ${calls.length}`,
        )
      }
      return call
    },
  }
}

/** Corpo JSON de uma chamada — falha se não houver corpo, em vez de virar "undefined". */
function jsonBodyOf(call: RecordedCall): unknown {
  const { body } = call.init
  if (typeof body !== "string") {
    throw new Error(`esperava corpo JSON em ${call.url}, veio ${typeof body}`)
  }
  return JSON.parse(body)
}

function abrirMenuDa(nome: string) {
  const linha = screen.getByText(nome).closest("tr")
  if (!linha) throw new Error(`linha de ${nome} não encontrada`)
  const gatilho = linha.querySelector('[aria-haspopup="menu"]')
  if (!gatilho) throw new Error("gatilho do menu não encontrado")
  fireEvent.click(gatilho)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  )
})

describe("AC2 — Cargo e Área renderizam o NOME resolvido", () => {
  const comVinculo = {
    ...orgFields,
    id: "u9",
    full_name: "Ana Coordenadora",
    email: "ana@test.com",
    role: "manager",
    status: "active",
    avatar_url: null,
    created_at: "2026-02-01T00:00:00Z",
    last_sign_in_at: null,
    job_role_id: "jr-1",
    job_role_name: "Coordenadora de Campo",
    area_names: ["Ribeirão Preto"],
    area_ids: ["area-rp"],
  }

  it("mostra os cabeçalhos Cargo e Área", () => {
    render(<UserList initialData={[comVinculo]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Cargo")).toBeInTheDocument()
    expect(screen.getByText("Área")).toBeInTheDocument()
  })

  it("mostra o NOME do cargo e o NOME da área, não os ids", () => {
    render(<UserList initialData={[comVinculo]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Coordenadora de Campo")).toBeInTheDocument()
    expect(screen.getByText("Ribeirão Preto")).toBeInTheDocument()
    expect(screen.queryByText("jr-1")).not.toBeInTheDocument()
    expect(screen.queryByText("area-rp")).not.toBeInTheDocument()
  })

  it("sem cargo nem área, as duas colunas mostram travessão em vez de vazio", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    // 3 linhas x 2 colunas + 1 nome nulo = 7 travessões, no mínimo os 6 das colunas.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6)
  })
})

describe("AC5 — o menu ⋯ depende do estado da linha", () => {
  const ativo = {
    ...orgFields,
    id: "u-ativo",
    full_name: "Pessoa Ativa",
    email: "ativa@test.com",
    role: "student",
    status: "active",
    avatar_url: null,
    created_at: "2026-02-01T00:00:00Z",
    last_sign_in_at: null,
    area_ids: [] as string[],
    area_names: [] as string[],
  }
  const desativado = { ...ativo, id: "u-off", full_name: "Pessoa Desligada", status: "inactive" }

  it("ativo: Editar ficha, Mover de área, Redefinir senha, Ver ações e Desativar", () => {
    render(<UserList initialData={[ativo]} initialCursor={null} currentUserId="u1" areas={AREAS} />)
    abrirMenuDa("Pessoa Ativa")

    expect(screen.getByText("Editar ficha")).toBeInTheDocument()
    expect(screen.getByText("Mover de área")).toBeInTheDocument()
    expect(screen.getByText("Redefinir senha")).toBeInTheDocument()
    expect(screen.getByText("Ver ações")).toBeInTheDocument()
    expect(screen.getByText("Desativar")).toBeInTheDocument()
    expect(screen.queryByText("Reativar")).not.toBeInTheDocument()
  })

  it("desativado: Reativar, Editar ficha e Ver ações — e NADA de mover/senha", () => {
    render(
      <UserList initialData={[desativado]} initialCursor={null} currentUserId="u1" areas={AREAS} />,
    )
    abrirMenuDa("Pessoa Desligada")

    expect(screen.getByText("Reativar")).toBeInTheDocument()
    expect(screen.getByText("Editar ficha")).toBeInTheDocument()
    expect(screen.getByText("Ver ações")).toBeInTheDocument()
    expect(screen.queryByText("Mover de área")).not.toBeInTheDocument()
    expect(screen.queryByText("Redefinir senha")).not.toBeInTheDocument()
    expect(screen.queryByText("Desativar")).not.toBeInTheDocument()
  })

  it("sem áreas cadastradas, 'Mover de área' não aparece como opção morta", () => {
    render(<UserList initialData={[ativo]} initialCursor={null} currentUserId="u1" areas={[]} />)
    abrirMenuDa("Pessoa Ativa")

    expect(screen.queryByText("Mover de área")).not.toBeInTheDocument()
  })

  it("desativar pede confirmação em sheet ANTES de chamar a API", () => {
    const fetchSpy = stubFetch({ ok: true })

    render(<UserList initialData={[ativo]} initialCursor={null} currentUserId="u1" areas={AREAS} />)
    abrirMenuDa("Pessoa Ativa")
    fireEvent.click(screen.getByText("Desativar"))

    // A sheet apareceu e NENHUMA escrita aconteceu ainda.
    expect(screen.getByText("Desativar usuário")).toBeInTheDocument()
    expect(fetchSpy.mock).not.toHaveBeenCalled()
  })
})

describe("AC6 — Mover de área usa a MESMA mutação de `user_areas` do lado da área", () => {
  const pessoa = {
    ...orgFields,
    id: "u-mover",
    full_name: "Bruno Movido",
    email: "bruno@test.com",
    role: "student",
    status: "active",
    avatar_url: null,
    created_at: "2026-02-01T00:00:00Z",
    last_sign_in_at: null,
    area_ids: ["area-rp"],
    area_names: ["Ribeirão Preto"],
  }

  it("remove o vínculo antigo e cria o novo, pelas rotas de /api/admin/areas", async () => {
    const fetchSpy = stubFetch({ ok: true })

    render(
      <UserList initialData={[pessoa]} initialCursor={null} currentUserId="u1" areas={AREAS} />,
    )
    abrirMenuDa("Bruno Movido")
    fireEvent.click(screen.getByText("Mover de área"))

    fireEvent.change(screen.getByLabelText("Área destino"), { target: { value: "area-mg" } })
    fireEvent.click(screen.getByText("Mover"))

    // As duas chamadas aconteceram — só depois disso é que vale olhar o que foi
    // enviado em cada uma.
    await waitFor(() => expect(fetchSpy.mock).toHaveBeenCalledTimes(2))

    // 1) DELETE na área ANTIGA — mover não pode virar acumular.
    const remocao = fetchSpy.callAt(0)
    expect(remocao.url).toBe("/api/admin/areas/area-rp/users?user_id=u-mover")
    expect(remocao.init.method).toBe("DELETE")

    // 2) POST na área NOVA, com o mesmo corpo que a tela de áreas envia.
    const vinculo = fetchSpy.callAt(1)
    expect(vinculo.url).toBe("/api/admin/areas/area-mg/users")
    expect(vinculo.init.method).toBe("POST")
    expect(jsonBodyOf(vinculo)).toEqual({ user_id: "u-mover" })

    // A coluna Área reflete o novo estado sem recarregar a página.
    await waitFor(() => expect(screen.getByText("Minas Gerais")).toBeInTheDocument())
  })

  it("falha ao remover do antigo NÃO cria o novo vínculo", async () => {
    const fetchSpy = stubFetch({ ok: false, body: { error: "Sem permissão na área" } })

    render(
      <UserList initialData={[pessoa]} initialCursor={null} currentUserId="u1" areas={AREAS} />,
    )
    abrirMenuDa("Bruno Movido")
    fireEvent.click(screen.getByText("Mover de área"))
    fireEvent.change(screen.getByLabelText("Área destino"), { target: { value: "area-mg" } })
    fireEvent.click(screen.getByText("Mover"))

    await waitFor(() => expect(screen.getByText("Sem permissão na área")).toBeInTheDocument())
    // Só a tentativa de DELETE. O POST não aconteceu: a pessoa não pode acabar
    // em DUAS áreas por causa de um erro no meio do caminho.
    expect(fetchSpy.mock).toHaveBeenCalledTimes(1)
    expect(fetchSpy.callAt(0).init.method).toBe("DELETE")
  })
})
