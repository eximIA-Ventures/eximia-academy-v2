import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CARGOS — o escopo de empresa, para quem NÃO tem empresa própria.
//
// `/admin/configuracoes/cargos` e a rota antiga `/admin/job-roles` leem pelo
// mesmo `loadAdminJobRoles`, que compõe `listJobRolesWithStats` + `listAreas`.
// Nenhuma das duas filtrava `tenant_id`: o escopo era 100% delegado ao RLS. Para
// o DONO DO PRODUTO (o único `super_admin` de produção, `tenant_id = NULL`) isso
// dava DOIS erros ao mesmo tempo:
//
//   - `job_roles` tem bypass de super_admin (`jr_super_admin`), então a lista
//     vinha com os cargos de TODAS as empresas misturados — a empresa escolhida
//     no seletor era simplesmente ignorada;
//   - `areas` NÃO tem bypass (`areas_select` é só `tenant_id = auth_tenant_id()`,
//     e `auth_tenant_id()` é NULL para ele), então o nome da área saía nulo e o
//     `select` de área do formulário vinha vazio.
//
// Estes testes exercitam o `resolveTenantId` REAL — é ele quem lê o cookie
// `x-sa-active-tenant` gravado pelo seletor (`api/admin/switch-tenant/route.ts`).
// Só `getAuthProfile`/`getDbClient` são substituídos (I/O de sessão).
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>
interface Filter {
  op: "eq" | "in"
  col: string
  val: unknown
}
interface Query {
  client: "db" | "service"
  table: string
  filters: Filter[]
}

let tables: Record<string, Row[]> = {}
let queries: Query[] = []
let cookieValue: string | undefined

function makeClient(client: "db" | "service") {
  return {
    from: (table: string) => {
      const filters: Filter[] = []
      queries.push({ client, table, filters })

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
      builder.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected)
      return builder
    },
  }
}

const dbClient = makeClient("db")
const serviceClient = makeClient("service")

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => dbClient) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => serviceClient) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

let authProfile: {
  user: { id: string } | null
  profile: { role: string; tenant_id: string | null } | null
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    // O REAL — é ele o objeto do teste (lê o cookie do seletor).
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
    // Fiel ao real: service client SÓ para perfil sem tenant próprio.
    getDbClient: vi.fn(async () => (authProfile.profile?.tenant_id ? dbClient : serviceClient)),
  }
})

const { loadAdminJobRoles } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

const SA = { user: { id: "sa-1" }, profile: { role: "super_admin", tenant_id: null } }
const ADMIN_T7 = { user: { id: "adm-1" }, profile: { role: "admin", tenant_id: "tenant-7" } }

beforeEach(() => {
  vi.clearAllMocks()
  queries = []
  cookieValue = undefined
  tables = {
    tenants: [{ id: "tenant-1" }, { id: "tenant-42" }, { id: "tenant-7" }],
    job_roles: [
      {
        id: "jr-a",
        tenant_id: "tenant-42",
        name: "Analista",
        slug: "analista",
        description: null,
        seniority_level: "mid",
        area_id: "area-1",
        created_at: "2026-01-01",
      },
      {
        id: "jr-b",
        tenant_id: "tenant-7",
        name: "Coordenador",
        slug: "coordenador",
        description: null,
        seniority_level: "senior",
        area_id: "area-9",
        created_at: "2026-01-02",
      },
    ],
    areas: [
      { id: "area-1", tenant_id: "tenant-42", name: "Ribeirão Preto" },
      { id: "area-9", tenant_id: "tenant-7", name: "Minas Gerais" },
    ],
    learning_trails: [
      { target_job_role_id: "jr-a", status: "active" },
      { target_job_role_id: "jr-b", status: "active" },
    ],
  }
  authProfile = SA
})

function tenantFilters(table: string) {
  return queries.filter((q) => q.table === table).flatMap((q) => q.filters)
}

/* ---------------------------------- Testes -------------------------------- */

describe("Cargos — super_admin com empresa escolhida no seletor", () => {
  it("carrega os cargos DAQUELA empresa, e só dela", async () => {
    cookieValue = "tenant-42"

    const { roles } = await loadAdminJobRoles()

    expect(roles.map((r) => r.name)).toEqual(["Analista"])
    // O que estava errado: sem `.eq("tenant_id", ...)`, o bypass `jr_super_admin`
    // devolvia os cargos das OUTRAS empresas junto.
    expect(roles.map((r) => r.id)).not.toContain("jr-b")
    expect(tenantFilters("job_roles")).toContainEqual({
      op: "eq",
      col: "tenant_id",
      val: "tenant-42",
    })
  })

  it("resolve o nome da área e a contagem de trilhas da empresa escolhida", async () => {
    cookieValue = "tenant-42"

    const { roles } = await loadAdminJobRoles()

    expect(roles[0]?.area_name).toBe("Ribeirão Preto")
    expect(roles[0]?.active_trails_count).toBe(1)
  })

  it("o select de Área do formulário deixa de vir vazio", async () => {
    cookieValue = "tenant-42"

    const { areas } = await loadAdminJobRoles()

    // `areas_select` não tem bypass de super_admin: sob RLS com tenant nulo esta
    // lista era SEMPRE `[]`, e o campo "Área" era um select sem uma única opção.
    expect(areas.map((a) => a.name)).toEqual(["Ribeirão Preto"])
    expect(tenantFilters("areas")).toContainEqual({
      op: "eq",
      col: "tenant_id",
      val: "tenant-42",
    })
  })

  it("trocar de empresa no seletor troca os cargos carregados", async () => {
    cookieValue = "tenant-42"
    const first = await loadAdminJobRoles()
    cookieValue = "tenant-7"
    const second = await loadAdminJobRoles()

    expect(first.roles.map((r) => r.name)).toEqual(["Analista"])
    expect(second.roles.map((r) => r.name)).toEqual(["Coordenador"])
  })

  it("lê pelo service client (sob RLS puro a leitura escopada voltaria vazia)", async () => {
    cookieValue = "tenant-42"

    await loadAdminJobRoles()

    expect(queries.filter((q) => q.table === "job_roles").map((q) => q.client)).toEqual(["service"])
    expect(queries.filter((q) => q.table === "areas").every((q) => q.client === "service")).toBe(
      true,
    )
  })

  it("sem cookie, cai no primeiro tenant do banco (mesmo fallback dos outros loaders)", async () => {
    tables.job_roles = [
      {
        id: "jr-c",
        tenant_id: "tenant-1",
        name: "Primeiro",
        slug: "primeiro",
        description: null,
        seniority_level: "mid",
        area_id: null,
        created_at: "2026-01-03",
      },
    ]

    const { roles } = await loadAdminJobRoles()

    expect(roles.map((r) => r.name)).toEqual(["Primeiro"])
  })

  it("nenhuma empresa resolvível devolve listas vazias, sem estourar", async () => {
    tables.tenants = []

    const { roles, areas } = await loadAdminJobRoles()

    expect(roles).toEqual([])
    expect(areas).toEqual([])
  })
})

describe("Cargos — admin de tenant (a esmagadora maioria) NÃO regride", () => {
  it("lê o PRÓPRIO tenant, ignora o cookie e não usa service client", async () => {
    authProfile = ADMIN_T7
    cookieValue = "tenant-42"

    const { roles, areas } = await loadAdminJobRoles()

    expect(roles.map((r) => r.name)).toEqual(["Coordenador"])
    expect(areas.map((a) => a.name)).toEqual(["Minas Gerais"])
    expect(queries.every((q) => q.client === "db")).toBe(true)
    expect(tenantFilters("job_roles")).toContainEqual({
      op: "eq",
      col: "tenant_id",
      val: "tenant-7",
    })
  })

  it("sem sessão devolve vazio e não consulta cargo nenhum", async () => {
    authProfile = { user: null, profile: null }

    const { roles, areas } = await loadAdminJobRoles()

    expect(roles).toEqual([])
    expect(areas).toEqual([])
    expect(queries).toHaveLength(0)
  })
})
