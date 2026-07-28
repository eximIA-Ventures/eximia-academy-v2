import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// USUÁRIOS — o escopo de empresa, para quem NÃO tem empresa própria.
//
// `/admin/configuracoes/usuarios` e a rota antiga `/admin/users` leem pelo mesmo
// `loadAdminUsers`. Ele NÃO usava `resolveTenantId` (a auditoria afirmava que
// sim): reimplementava a cascata à mão, e o último degrau (primeiro tenant do
// banco) lia `tenants` pelo client SOB RLS. Para o `super_admin` isso funciona
// por acidente feliz (política `super_admin_all_tenants`); para um `admin` de
// tenant nulo, `tenants_select` (`id = auth_tenant_id()`) devolveria zero linhas
// e a tela inteira ficaria vazia.
//
// Estes testes exercitam o `resolveTenantId` REAL, para provar que a tela carrega
// os dados DA EMPRESA ESCOLHIDA no seletor — e que quem tem tenant próprio não
// regride.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type Row = Record<string, unknown>
interface Filter {
  op: "eq" | "in" | "or"
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
          filters.every((f) => {
            if (f.op === "eq") return r[f.col] === f.val
            if (f.op === "in") return (f.val as unknown[]).includes(r[f.col])
            return true
          }),
        )

      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.or = () => builder
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
        onFulfilled: (value: { data: unknown; error: null; count: number }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({ data: rows(), error: null, count: rows().length }).then(
          onFulfilled,
          onRejected,
        )
      return builder
    },
  }
}

const dbClient = makeClient("db")
const serviceClient = makeClient("service")

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
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
    getDbClient: vi.fn(async () => (authProfile.profile?.tenant_id ? dbClient : serviceClient)),
  }
})

const { loadAdminUsers } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

const SA = { user: { id: "sa-1" }, profile: { role: "super_admin", tenant_id: null } }
const ADMIN_T7 = { user: { id: "adm-1" }, profile: { role: "admin", tenant_id: "tenant-7" } }

function userRow(id: string, tenant: string, name: string) {
  return {
    id,
    tenant_id: tenant,
    full_name: name,
    email: `${id}@x.com`,
    role: "student",
    status: "active",
    avatar_url: null,
    created_at: "2026-01-01",
    reports_to: null,
    job_role_id: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  queries = []
  cookieValue = undefined
  tables = {
    tenants: [{ id: "tenant-1" }, { id: "tenant-42" }, { id: "tenant-7" }],
    users: [
      userRow("u-a", "tenant-42", "Alice"),
      userRow("u-b", "tenant-7", "Bruno"),
      userRow("u-c", "tenant-1", "Carla"),
    ],
    areas: [
      { id: "area-1", tenant_id: "tenant-42", name: "Ribeirão Preto", slug: "rp" },
      { id: "area-9", tenant_id: "tenant-7", name: "Minas Gerais", slug: "mg" },
    ],
    job_roles: [
      { id: "jr-a", tenant_id: "tenant-42", name: "Analista" },
      { id: "jr-b", tenant_id: "tenant-7", name: "Coordenador" },
    ],
  }
  authProfile = SA
})

function tenantFilters(table: string) {
  return queries.filter((q) => q.table === table).flatMap((q) => q.filters)
}

/* ---------------------------------- Testes -------------------------------- */

describe("Usuários — super_admin com empresa escolhida no seletor", () => {
  it("carrega usuários, áreas e cargos DAQUELA empresa", async () => {
    cookieValue = "tenant-42"

    const loaded = await loadAdminUsers({})

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.data.users.map((u) => u.full_name)).toEqual(["Alice"])
    expect(loaded.data.areas.map((a) => a.name)).toEqual(["Ribeirão Preto"])
    expect(loaded.data.jobRoles.map((j) => j.name)).toEqual(["Analista"])
    expect(tenantFilters("users")).toContainEqual({
      op: "eq",
      col: "tenant_id",
      val: "tenant-42",
    })
  })

  it("trocar de empresa no seletor troca os usuários carregados", async () => {
    cookieValue = "tenant-42"
    const first = await loadAdminUsers({})
    cookieValue = "tenant-7"
    const second = await loadAdminUsers({})

    expect(first.kind === "ok" && first.data.users.map((u) => u.full_name)).toEqual(["Alice"])
    expect(second.kind === "ok" && second.data.users.map((u) => u.full_name)).toEqual(["Bruno"])
  })

  it("lê pelo service client (perfil sem tenant próprio)", async () => {
    cookieValue = "tenant-42"

    await loadAdminUsers({})

    expect(queries.filter((q) => q.table === "users").every((q) => q.client === "service")).toBe(
      true,
    )
  })

  it("sem cookie, o fallback do primeiro tenant usa o SERVICE client", async () => {
    // A cascata manual antiga consultava `tenants` sob RLS aqui. Para um `admin`
    // de tenant nulo isso devolveria zero linhas (`tenants_select` é
    // `id = auth_tenant_id()`) e a tela inteira ficaria vazia.
    const loaded = await loadAdminUsers({})

    expect(loaded.kind === "ok" && loaded.data.users.map((u) => u.full_name)).toEqual(["Carla"])
    expect(queries.filter((q) => q.table === "tenants").map((q) => q.client)).toEqual(["service"])
  })
})

describe("Usuários — admin de tenant (a esmagadora maioria) NÃO regride", () => {
  it("lê o PRÓPRIO tenant, ignora o cookie e não usa service client", async () => {
    authProfile = ADMIN_T7
    cookieValue = "tenant-42"

    const loaded = await loadAdminUsers({})

    expect(loaded.kind === "ok" && loaded.data.users.map((u) => u.full_name)).toEqual(["Bruno"])
    expect(queries.every((q) => q.client === "db")).toBe(true)
    // Nenhuma consulta a `tenants`: a cascata para na primeira linha.
    expect(queries.some((q) => q.table === "tenants")).toBe(false)
  })

  it("sem sessão devolve 'unauthenticated' sem consultar nada", async () => {
    authProfile = { user: null, profile: null }

    const loaded = await loadAdminUsers({})

    expect(loaded.kind).toBe("unauthenticated")
    expect(queries).toHaveLength(0)
  })
})
