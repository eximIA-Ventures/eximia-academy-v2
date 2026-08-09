import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// BECO MORTO DO SELETOR DE EMPRESA (auditoria, rodada 3).
//
// `loadTenantSettings` resolvia o tenant como
// `profile.role === "super_admin" ? null : profile.tenant_id` — SEMPRE `null`
// para o super_admin (e para o admin global, de `tenant_id` nulo). As três telas
// que o consomem caíam no `TenantRequiredState`, cuja cópia manda escolher a
// empresa no seletor do topo. Só que este era o ÚNICO loader administrativo que
// nunca lia o cookie `x-sa-active-tenant` gravado pelo seletor
// (`api/admin/switch-tenant/route.ts:33`): a pessoa executava a instrução da
// tela e a tela não mudava NUNCA.
//
// Estes testes exercitam o `resolveTenantId` REAL (não um mock dele) — é ele que
// lê o cookie. Só `getAuthProfile` e `getDbClient` são substituídos, porque são
// I/O de sessão. Se alguém reverter a linha, o caso 1 fica vermelho.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

let cookieValue: string | undefined
/** O que `select("id").limit(1)` sobre `tenants` devolve (fallback do resolve). */
let tenantsInDb: { id: string }[] = []
/** Linhas de `tenants` por id, para a leitura `.eq("id", X).single()`. */
let tenantsById: Record<string, Record<string, unknown>> = {}

interface EqCall {
  client: "db" | "service"
  table: string
  column: string
  value: unknown
}
let eqCalls: EqCall[] = []
let listQueries: { client: "db" | "service"; table: string }[] = []

function makeClient(client: "db" | "service") {
  return {
    from: vi.fn((table: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock builder
      const builder: any = {}
      let idFilter: string | null = null

      builder.select = vi.fn(() => builder)
      builder.order = vi.fn(() => builder)
      builder.eq = vi.fn((column: string, value: unknown) => {
        eqCalls.push({ client, table, column, value })
        if (column === "id" && typeof value === "string") idFilter = value
        return builder
      })
      builder.limit = vi.fn(() => builder)
      builder.single = vi.fn(() => {
        const row = idFilter ? tenantsById[idFilter] : undefined
        return Promise.resolve(
          row ? { data: row, error: null } : { data: null, error: { message: "not found" } },
        )
      })
      // Awaitable form (`select(...).limit(1)`), usada pelo fallback do resolve.
      // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        listQueries.push({ client, table })
        return Promise.resolve({ data: tenantsInDb, error: null }).then(onFulfilled, onRejected)
      }
      return builder
    }),
  }
}

const serviceClient = makeClient("service")
const dbClient = makeClient("db")

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => dbClient),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => serviceClient),
}))

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
    // O REAL — é o objeto do teste: ele é quem lê `x-sa-active-tenant`.
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
    getDbClient: vi.fn(async () => dbClient),
  }
})

const { loadTenantSettings } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

const SA = { user: { id: "sa-1" }, profile: { role: "super_admin", tenant_id: null } }

function tenantRow(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    branding: { primary_color: "#123456" },
    settings: { features: { certificates: true } },
    plan: "pro",
    whitelabel_enabled: true,
    whitelabel_config: { app_name: name },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieValue = undefined
  tenantsInDb = []
  eqCalls = []
  listQueries = []
  tenantsById = {
    "tenant-42": tenantRow("tenant-42", "Cory"),
    "tenant-1": tenantRow("tenant-1", "Primeira"),
    "tenant-7": tenantRow("tenant-7", "Propria"),
  }
  authProfile = SA
})

/* ---------------------------------- Testes -------------------------------- */

describe("loadTenantSettings — o seletor de empresa funciona de verdade", () => {
  it("super_admin com x-sa-active-tenant setado carrega AS CONFIGURAÇÕES DAQUELA EMPRESA", async () => {
    // Este é o caso que ficava preso: com a regra antiga
    // (`role === "super_admin" ? null : ...`) o retorno era SEMPRE "no-tenant",
    // por mais que o seletor gravasse o cookie.
    cookieValue = "tenant-42"

    const loaded = await loadTenantSettings()

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.tenant.id).toBe("tenant-42")
    expect(loaded.tenant.name).toBe("Cory")
    expect(loaded.tenant.whitelabelConfig).toEqual({ app_name: "Cory" })
    // A leitura foi escopada pela empresa escolhida no seletor.
    expect(eqCalls).toContainEqual({
      client: "db",
      table: "tenants",
      column: "id",
      value: "tenant-42",
    })
    // E o cookie venceu: o fallback "primeiro tenant do banco" nem foi consultado.
    expect(listQueries).toHaveLength(0)
  })

  it("trocar de empresa no seletor troca a empresa carregada", async () => {
    cookieValue = "tenant-42"
    const first = await loadTenantSettings()
    cookieValue = "tenant-1"
    const second = await loadTenantSettings()

    expect(first.kind === "ok" && first.tenant.id).toBe("tenant-42")
    expect(second.kind === "ok" && second.tenant.id).toBe("tenant-1")
  })

  it("sem cookie, cai no primeiro tenant do banco (mesmo fallback dos outros loaders)", async () => {
    tenantsInDb = [{ id: "tenant-1" }]

    const loaded = await loadTenantSettings()

    expect(loaded.kind).toBe("ok")
    expect(loaded.kind === "ok" && loaded.tenant.id).toBe("tenant-1")
    expect(listQueries).toContainEqual({ client: "service", table: "tenants" })
  })

  it("'no-tenant' sobra SÓ quando não há empresa nenhuma resolvível", async () => {
    tenantsInDb = []

    const loaded = await loadTenantSettings()

    expect(loaded.kind).toBe("no-tenant")
  })

  it("admin com tenant próprio ignora o cookie e lê o PRÓPRIO tenant (W4, inalterado)", async () => {
    authProfile = { user: { id: "adm-1" }, profile: { role: "admin", tenant_id: "tenant-7" } }
    cookieValue = "tenant-42"

    const loaded = await loadTenantSettings()

    expect(loaded.kind === "ok" && loaded.tenant.id).toBe("tenant-7")
    expect(eqCalls).toContainEqual({
      client: "db",
      table: "tenants",
      column: "id",
      value: "tenant-7",
    })
    // Nenhum service client e nenhum fallback para quem tem tenant próprio.
    expect(listQueries).toHaveLength(0)
  })

  it("sem sessão devolve 'unauthenticated' e não consulta tenant nenhum", async () => {
    authProfile = { user: null, profile: null }

    const loaded = await loadTenantSettings()

    expect(loaded.kind).toBe("unauthenticated")
    expect(eqCalls).toHaveLength(0)
    expect(listQueries).toHaveLength(0)
  })
})
