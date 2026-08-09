import { beforeEach, describe, expect, it, vi } from "vitest"

/* ---------------------------------- Mocks --------------------------------- */

interface QueryResult {
  data?: unknown
  error?: { message: string } | null
  count?: number
}

// Auth client (requireAdmin): FIFO queue consumed by .single()
let responseQueue: QueryResult[] = []
let authUser: { id: string } | null = null

function makeAuthBuilder() {
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const builder: any = {}
  for (const method of ["select", "eq", "update", "insert", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(responseQueue.shift() ?? { data: null }))
  return builder
}

const mockClient = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: authUser } })),
  },
  from: vi.fn(() => makeAuthBuilder()),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockClient),
}))

// Service client: thenable chainable builders, one FIFO result per awaited query
let serviceQueue: QueryResult[] = []
// biome-ignore lint/suspicious/noExplicitAny: test mock
const serviceBuilders: Array<{ table: string; builder: any }> = []

function makeServiceBuilder(table: string) {
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const builder: any = {}
  for (const method of ["select", "eq", "gte", "or", "order", "range", "limit", "in"]) {
    builder[method] = vi.fn(() => builder)
  }
  // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the awaitable supabase query builder
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve(serviceQueue.shift() ?? { data: [], error: null, count: 0 }).then(
      onFulfilled,
      onRejected,
    )
  serviceBuilders.push({ table, builder })
  return builder
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => makeServiceBuilder(table)),
  }),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))

// Import after mocking
const { GET } = await import("../route")

/* -------------------------------- Fixtures -------------------------------- */

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const ACTOR_ID = "22222222-2222-4222-8222-222222222222"
const FILTER_ID = "33333333-3333-4333-8333-333333333333"

const adminProfile = { id: ADMIN_ID, role: "admin", tenant_id: "tenant-1" }

const auditRow = {
  id: "row-1",
  actor_id: ACTOR_ID,
  action: "area.created",
  target_type: "area",
  target_id: "44444444-4444-4444-8444-444444444444",
  details: { tenant_id: "tenant-1", name: "Vendas", ip: "10.0.0.1" },
  created_at: "2026-07-22T12:00:00.000Z",
}

function getRequest(params = "") {
  return new Request(`http://localhost/api/admin/audit-log${params ? `?${params}` : ""}`)
}

function auditBuilder() {
  return serviceBuilders.find((b) => b.table === "platform_audit_log")?.builder
}

beforeEach(() => {
  vi.clearAllMocks()
  responseQueue = []
  serviceQueue = []
  serviceBuilders.length = 0
  authUser = { id: ADMIN_ID }
})

/* --------------------------------- Guard ---------------------------------- */

describe("GET /api/admin/audit-log — guard", () => {
  it("returns 401 when unauthenticated", async () => {
    authUser = null

    const res = await GET(getRequest())

    expect(res.status).toBe(401)
    expect(serviceBuilders.length).toBe(0)
  })

  it("returns 403 when the caller is not admin/super_admin", async () => {
    responseQueue = [{ data: { id: ADMIN_ID, role: "student", tenant_id: "tenant-1" } }]

    const res = await GET(getRequest())

    expect(res.status).toBe(403)
    expect(serviceBuilders.length).toBe(0)
  })

  it("returns 400 when there is no resolvable tenant", async () => {
    responseQueue = [{ data: { id: ADMIN_ID, role: "super_admin", tenant_id: null } }]

    const res = await GET(getRequest())

    expect(res.status).toBe(400)
  })

  // Auditoria (rodada 3): a PÁGINA `/admin/audit` abre pelo chapéu real
  // (`canOpenAdminRoute`) e esta rota, única fonte de dados dela, decidia pela
  // coluna singular. Os dois lados agora respondem ao MESMO eixo.
  it("admits the hat `admin` even when users.role says 'instructor'", async () => {
    responseQueue = [
      {
        data: {
          id: ADMIN_ID,
          role: "instructor",
          tenant_id: "tenant-1",
          user_roles: [{ role: "admin" }],
        },
      },
    ]
    serviceQueue = [{ data: [], count: 0 }]

    const res = await GET(getRequest())

    expect(res.status).toBe(200)
  })

  it("rejects users.role='admin' when the hats say otherwise (hat wins)", async () => {
    responseQueue = [
      {
        data: {
          id: ADMIN_ID,
          role: "admin",
          tenant_id: "tenant-1",
          user_roles: [{ role: "student" }],
        },
      },
    ]

    const res = await GET(getRequest())

    expect(res.status).toBe(403)
    expect(serviceBuilders.length).toBe(0)
  })
})

/* ------------------------------ Tenant scope ------------------------------ */

describe("GET /api/admin/audit-log — tenant scope", () => {
  it("always filters by details.tenant_id of the caller's tenant", async () => {
    responseQueue = [{ data: adminProfile }]
    serviceQueue = [
      { data: [auditRow], count: 1 },
      { data: [{ id: ACTOR_ID, full_name: "Ana Admin", email: "ana@t1.com" }] },
    ]

    const res = await GET(getRequest())

    expect(res.status).toBe(200)
    const audit = auditBuilder()
    expect(audit.eq).toHaveBeenCalledWith("details->>tenant_id", "tenant-1")

    const json = await res.json()
    expect(json.total).toBe(1)
    expect(json.data[0].actor).toEqual({
      id: ACTOR_ID,
      full_name: "Ana Admin",
      email: "ana@t1.com",
    })
    expect(json.data[0].ip).toBe("10.0.0.1")
  })

  it("applies the type filter on target_type", async () => {
    responseQueue = [{ data: adminProfile }]
    serviceQueue = [{ data: [], count: 0 }]

    const res = await GET(getRequest("type=api_key"))

    expect(res.status).toBe(200)
    expect(auditBuilder().eq).toHaveBeenCalledWith("target_type", "api_key")
  })
})

/* ------------------------------- User filter ------------------------------ */

describe("GET /api/admin/audit-log — user filter", () => {
  it("matches actor OR target-user with a valid uuid", async () => {
    responseQueue = [{ data: adminProfile }]
    serviceQueue = [{ data: [], count: 0 }]

    const res = await GET(getRequest(`user=${FILTER_ID}`))

    expect(res.status).toBe(200)
    expect(auditBuilder().or).toHaveBeenCalledWith(
      `actor_id.eq.${FILTER_ID},and(target_id.eq.${FILTER_ID},target_type.eq.user)`,
    )
  })

  it("rejects a non-uuid user filter with 400", async () => {
    responseQueue = [{ data: adminProfile }]

    const res = await GET(getRequest("user=not-a-uuid"))

    expect(res.status).toBe(400)
    expect(serviceBuilders.length).toBe(0)
  })
})

/* ---------------------------------- CSV ----------------------------------- */

describe("GET /api/admin/audit-log — csv export", () => {
  it("returns text/csv with the same filters and no pagination range", async () => {
    responseQueue = [{ data: adminProfile }]
    serviceQueue = [
      { data: [auditRow], count: 1 },
      { data: [{ id: ACTOR_ID, full_name: "Ana Admin", email: "ana@t1.com" }] },
    ]

    const res = await GET(getRequest("format=csv&type=area"))

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    expect(res.headers.get("Content-Disposition")).toContain("audit-log.csv")

    const audit = auditBuilder()
    expect(audit.eq).toHaveBeenCalledWith("details->>tenant_id", "tenant-1")
    expect(audit.eq).toHaveBeenCalledWith("target_type", "area")
    expect(audit.limit).toHaveBeenCalled()
    expect(audit.range).not.toHaveBeenCalled()

    const body = await res.text()
    expect(body.split("\n")[0]).toBe("quando,acao,autor,tipo,alvo,ip,detalhes")
    expect(body).toContain("area.created")
    expect(body).toContain("Ana Admin")
  })
})
