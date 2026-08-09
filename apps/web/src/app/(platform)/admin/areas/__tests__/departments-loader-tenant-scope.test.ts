import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// AC0.1 — O MAPA NUNCA MISTURA EMPRESAS.
//
// As 3 tabelas de departamento têm bypass `is_super_admin()` na policy de SELECT
// que a tabela `areas` (unidade) não tem. Consequência concreta para o dono do
// produto (único super_admin, `tenant_id` NULL): sem filtro explícito no client,
// as COLUNAS do kanban viriam de uma empresa e as PILHAS de todas — e nada
// falharia. Sem erro, sem exceção, só dado alheio na tela.
//
// O mock abaixo devolve TUDO o que a query não filtrou. Então, se algum dia
// alguém remover um `.eq("tenant_id", ...)` do loader, este teste passa a ver
// departamento de outra empresa e quebra. É essa a prova — não "eu revisei".
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>
interface Filter {
  op: "eq" | "in"
  col: string
  val: unknown
}
interface Query {
  table: string
  filters: Filter[]
}

let tables: Record<string, Row[]> = {}
let queries: Query[] = []
let cookieValue: string | undefined

function makeClient() {
  return {
    from: (table: string) => {
      const filters: Filter[] = []
      queries.push({ table, filters })

      const rows = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every((f) =>
            f.op === "eq" ? r[f.col] === f.val : (f.val as unknown[]).includes(r[f.col]),
          ),
        )

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.eq = (col: string, val: unknown) => {
        filters.push({ op: "eq", col, val })
        return builder
      }
      builder.in = (col: string, val: unknown) => {
        filters.push({ op: "in", col, val })
        return builder
      }
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected)
      return builder
    },
  }
}

const dbClient = makeClient()
const serviceClient = makeClient()

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => dbClient) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => serviceClient) }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

let authProfile: {
  user: { id: string } | null
  profile: { role: string; tenant_id: string | null } | null
  supabase: unknown
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
    getDbClient: vi.fn(async () => (authProfile.profile?.tenant_id ? dbClient : serviceClient)),
  }
})

const { loadAreasWorkspace } = await import("../departments-loader")

/* -------------------------------- Fixtures -------------------------------- */

const SUPER_ADMIN = {
  user: { id: "sa-1" },
  profile: { role: "super_admin", tenant_id: null },
  supabase: dbClient,
}
const ADMIN_CORY = {
  user: { id: "adm-1" },
  profile: { role: "admin", tenant_id: "cory" },
  supabase: dbClient,
}

beforeEach(() => {
  vi.clearAllMocks()
  queries = []
  cookieValue = undefined
  tables = {
    tenants: [{ id: "cory" }, { id: "outra-empresa" }],
    areas: [
      {
        id: "rp",
        tenant_id: "cory",
        name: "Ribeirão Preto",
        slug: "rp",
        description: "Unidade de SP",
        created_at: "2026-01-01",
      },
      {
        id: "alheia",
        tenant_id: "outra-empresa",
        name: "Unidade Alheia",
        slug: "alheia",
        description: null,
        created_at: "2026-01-01",
      },
    ],
    user_areas: [{ user_id: "ana", area_id: "rp" }],
    courses: [],
    departments: [
      {
        id: "financeiro",
        tenant_id: "cory",
        name: "Finanças",
        slug: "financas",
        description: null,
      },
      {
        id: "secreto",
        tenant_id: "outra-empresa",
        name: "Departamento da Outra Empresa",
        slug: "secreto",
        description: null,
      },
    ],
    department_areas: [
      { department_id: "financeiro", area_id: "rp", tenant_id: "cory" },
      { department_id: "secreto", area_id: "alheia", tenant_id: "outra-empresa" },
    ],
    user_departments: [
      { user_id: "ana", department_id: "financeiro", tenant_id: "cory" },
      { user_id: "estranho", department_id: "secreto", tenant_id: "outra-empresa" },
    ],
    users: [
      {
        id: "ana",
        tenant_id: "cory",
        full_name: "Ana Lima",
        email: "ana@cory.com",
        role: "manager",
      },
      {
        id: "estranho",
        tenant_id: "outra-empresa",
        full_name: "Pessoa Alheia",
        email: "x@outra.com",
        role: "manager",
      },
    ],
  }
  authProfile = SUPER_ADMIN
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC0.1 — super_admin não vê departamento de empresa alheia", () => {
  it("com a Cory escolhida no seletor, só carrega os departamentos da Cory", async () => {
    cookieValue = "cory"

    const loaded = await loadAreasWorkspace()

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.snapshot.departments.map((d) => d.id)).toEqual(["financeiro"])
    expect(loaded.snapshot.departments.map((d) => d.name)).not.toContain(
      "Departamento da Outra Empresa",
    )
  })

  it("as presenças e os vínculos de pessoa também vêm escopados", async () => {
    cookieValue = "cory"

    const loaded = await loadAreasWorkspace()

    if (loaded.kind !== "ok") throw new Error("esperado ok")
    expect(loaded.snapshot.presences).toEqual([{ departmentId: "financeiro", areaId: "rp" }])
    expect(loaded.snapshot.memberships).toEqual([{ userId: "ana", departmentId: "financeiro" }])
    expect(loaded.snapshot.people.map((p) => p.id)).toEqual(["ana"])
  })

  it("TODA query das 3 tabelas novas carrega .eq('tenant_id', ...) explícito", async () => {
    cookieValue = "cory"

    await loadAreasWorkspace()

    const novas = queries.filter((q) =>
      ["departments", "department_areas", "user_departments"].includes(q.table),
    )
    expect(novas.length).toBeGreaterThanOrEqual(3)
    for (const q of novas) {
      expect(q.filters).toContainEqual({ op: "eq", col: "tenant_id", val: "cory" })
    }
  })

  it("trocar de empresa no seletor troca os departamentos carregados", async () => {
    cookieValue = "cory"
    const primeiro = await loadAreasWorkspace()
    cookieValue = "outra-empresa"
    const segundo = await loadAreasWorkspace()

    expect(primeiro.kind === "ok" && primeiro.snapshot.departments.map((d) => d.id)).toEqual([
      "financeiro",
    ])
    expect(segundo.kind === "ok" && segundo.snapshot.departments.map((d) => d.id)).toEqual([
      "secreto",
    ])
  })
})

describe("admin de empresa não regride", () => {
  it("lê o próprio tenant e ignora o cookie de outra empresa", async () => {
    authProfile = ADMIN_CORY
    cookieValue = "outra-empresa"

    const loaded = await loadAreasWorkspace()

    if (loaded.kind !== "ok") throw new Error("esperado ok")
    expect(loaded.snapshot.departments.map((d) => d.id)).toEqual(["financeiro"])
  })

  it("sem sessão devolve 'unauthenticated'", async () => {
    authProfile = { user: null, profile: null, supabase: dbClient }

    const loaded = await loadAreasWorkspace()

    expect(loaded.kind).toBe("unauthenticated")
  })
})

describe("estado vazio — o que o dono vai encontrar hoje", () => {
  it("empresa com unidades e ZERO departamentos devolve snapshot vazio, não erro", async () => {
    cookieValue = "cory"
    tables.departments = []
    tables.department_areas = []
    tables.user_departments = []

    const loaded = await loadAreasWorkspace()

    if (loaded.kind !== "ok") throw new Error("esperado ok")
    expect(loaded.areas.map((a) => a.name)).toEqual(["Ribeirão Preto"])
    expect(loaded.snapshot.departments).toEqual([])
    expect(loaded.snapshot.people).toEqual([])
    // Sem membros, a leitura de pessoas nem chega a acontecer.
    expect(queries.some((q) => q.table === "users")).toBe(false)
  })
})
