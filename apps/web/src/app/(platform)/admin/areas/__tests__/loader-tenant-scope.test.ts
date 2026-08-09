import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// UNIDADES & ÁREAS — CONFIRMAÇÃO, não correção.
//
// `/admin/configuracoes/unidades` e a rota antiga `/admin/areas` leem pelo mesmo
// `loadAdminAreas`, que JÁ resolvia o tenant por `resolveTenantId` e JÁ trocava
// para o service client quando o perfil não tem tenant próprio (`loader.ts:41-48`).
// A auditoria da rodada 4 varreu as cinco seções vivas do hub e esta foi a única
// que não precisou de mudança.
//
// O teste existe porque "auditei e estava certo" não é verificável: sem ele, a
// próxima refatoração pode reintroduzir aqui exatamente o beco morto que
// `settings/loader.ts` teve e `job-roles/actions.ts` tinha.
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

const { loadAdminAreas } = await import("../loader")

/* -------------------------------- Fixtures -------------------------------- */

const SA = {
  user: { id: "sa-1" },
  profile: { role: "super_admin", tenant_id: null },
  supabase: dbClient,
}
const ADMIN_T7 = {
  user: { id: "adm-1" },
  profile: { role: "admin", tenant_id: "tenant-7" },
  supabase: dbClient,
}

beforeEach(() => {
  vi.clearAllMocks()
  queries = []
  cookieValue = undefined
  tables = {
    tenants: [{ id: "tenant-1" }, { id: "tenant-42" }, { id: "tenant-7" }],
    areas: [
      {
        id: "area-1",
        tenant_id: "tenant-42",
        name: "Ribeirão Preto",
        slug: "rp",
        description: null,
        created_at: "2026-01-01",
      },
      {
        id: "area-9",
        tenant_id: "tenant-7",
        name: "Minas Gerais",
        slug: "mg",
        description: null,
        created_at: "2026-01-02",
      },
    ],
    user_areas: [{ area_id: "area-1", user_id: "u-a" }],
    courses: [{ area_id: "area-1" }, { area_id: "area-1" }],
  }
  authProfile = SA
})

/* ---------------------------------- Testes -------------------------------- */

describe("Unidades — super_admin com empresa escolhida no seletor", () => {
  it("carrega as unidades DAQUELA empresa, com as contagens", async () => {
    cookieValue = "tenant-42"

    const loaded = await loadAdminAreas()

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.areas.map((a) => a.name)).toEqual(["Ribeirão Preto"])
    expect(loaded.areas[0]?.user_count).toBe(1)
    expect(loaded.areas[0]?.course_count).toBe(2)
    expect(queries.filter((q) => q.table === "areas").flatMap((q) => q.filters)).toContainEqual({
      op: "eq",
      col: "tenant_id",
      val: "tenant-42",
    })
  })

  it("trocar de empresa no seletor troca as unidades carregadas", async () => {
    cookieValue = "tenant-42"
    const first = await loadAdminAreas()
    cookieValue = "tenant-7"
    const second = await loadAdminAreas()

    expect(first.kind === "ok" && first.areas.map((a) => a.name)).toEqual(["Ribeirão Preto"])
    expect(second.kind === "ok" && second.areas.map((a) => a.name)).toEqual(["Minas Gerais"])
  })

  it("lê pelo service client (perfil sem tenant próprio)", async () => {
    cookieValue = "tenant-42"

    await loadAdminAreas()

    expect(queries.filter((q) => q.table === "areas").every((q) => q.client === "service")).toBe(
      true,
    )
  })
})

describe("Unidades — admin de tenant NÃO regride", () => {
  it("lê o PRÓPRIO tenant, ignora o cookie e não usa service client", async () => {
    authProfile = ADMIN_T7
    cookieValue = "tenant-42"

    const loaded = await loadAdminAreas()

    expect(loaded.kind === "ok" && loaded.areas.map((a) => a.name)).toEqual(["Minas Gerais"])
    expect(queries.every((q) => q.client === "db")).toBe(true)
  })

  it("sem sessão devolve 'unauthenticated' sem consultar nada", async () => {
    authProfile = { user: null, profile: null, supabase: dbClient }

    const loaded = await loadAdminAreas()

    expect(loaded.kind).toBe("unauthenticated")
    expect(queries).toHaveLength(0)
  })
})
