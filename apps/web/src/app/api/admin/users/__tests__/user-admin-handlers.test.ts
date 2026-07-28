import { beforeEach, describe, expect, it, vi } from "vitest"

/* ---------------------------------- Mocks --------------------------------- */

// Chainable Supabase query builder: each call to from() consumes responses
// from a FIFO queue seeded by the test (one entry per .single() resolution).
interface QueryResult {
  data?: unknown
  error?: { message: string } | null
}

let responseQueue: QueryResult[] = []
let authUser: { id: string } | null = null

function makeBuilder() {
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const builder: any = {}
  for (const method of ["select", "eq", "update", "insert", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(responseQueue.shift() ?? { data: null }))
  return builder
}

const mockFrom = vi.fn(() => makeBuilder())

const mockClient = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: authUser } })),
  },
  from: mockFrom,
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockClient),
}))

const mockGenerateLink = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: { admin: { generateLink: mockGenerateLink } },
    from: vi.fn(() => makeBuilder()),
  }),
}))

const mockLogAdminAction = vi.fn()
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
  logSuperAdminAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))

// Import after mocking
const { PATCH } = await import("../[userId]/route")
const { POST: RESET } = await import("../[userId]/reset-password/route")

/* -------------------------------- Fixtures -------------------------------- */

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const TARGET_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_ID = "33333333-3333-4333-8333-333333333333"
const JOB_ROLE_ID = "44444444-4444-4444-8444-444444444444"

const adminProfile = { id: ADMIN_ID, role: "admin", tenant_id: "tenant-1" }

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function routeParams(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  responseQueue = []
  authUser = { id: ADMIN_ID }
  mockGenerateLink.mockResolvedValue({ data: {}, error: null })
})

/* --------------------------- PATCH /users/[id] ---------------------------- */

describe("PATCH /api/admin/users/[userId] — organizational fields", () => {
  it("blocks a user from being their own superior", async () => {
    responseQueue = [{ data: adminProfile }]

    const res = await PATCH(patchRequest({ reportsTo: TARGET_ID }), routeParams(TARGET_ID))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/superior de si mesmo/i)
  })

  it("returns 404 when the target user belongs to another tenant", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, tenant_id: "tenant-OTHER" } }, // target
    ]

    const res = await PATCH(patchRequest({ reportsTo: OTHER_ID }), routeParams(TARGET_ID))

    expect(res.status).toBe(404)
  })

  it("rejects a superior that belongs to another tenant", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, tenant_id: "tenant-1" } }, // target
      { data: { id: OTHER_ID, tenant_id: "tenant-OTHER" } }, // superior
    ]

    const res = await PATCH(patchRequest({ reportsTo: OTHER_ID }), routeParams(TARGET_ID))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/superior imediato invalido/i)
  })

  it("rejects a job role that belongs to another tenant", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, tenant_id: "tenant-1" } }, // target
      { data: { id: JOB_ROLE_ID, tenant_id: "tenant-OTHER" } }, // job role
    ]

    const res = await PATCH(patchRequest({ jobRoleId: JOB_ROLE_ID }), routeParams(TARGET_ID))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/cargo invalido/i)
  })

  it("updates reports_to and job_role_id when everything is in the same tenant, and audits", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, tenant_id: "tenant-1" } }, // target
      { data: { id: OTHER_ID, tenant_id: "tenant-1" } }, // superior
      { data: { id: JOB_ROLE_ID, tenant_id: "tenant-1" } }, // job role
      { data: { id: TARGET_ID, reports_to: OTHER_ID, job_role_id: JOB_ROLE_ID } }, // update
    ]

    const res = await PATCH(
      patchRequest({ reportsTo: OTHER_ID, jobRoleId: JOB_ROLE_ID }),
      routeParams(TARGET_ID),
    )

    expect(res.status).toBe(200)
    expect(mockLogAdminAction).toHaveBeenCalledTimes(1)
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: "user.updated",
        targetType: "user",
        targetId: TARGET_ID,
      }),
    )
  })

  it("allows clearing reportsTo/jobRoleId with null", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, tenant_id: "tenant-1" } }, // target
      { data: { id: TARGET_ID, reports_to: null, job_role_id: null } }, // update
    ]

    const res = await PATCH(
      patchRequest({ reportsTo: null, jobRoleId: null }),
      routeParams(TARGET_ID),
    )

    expect(res.status).toBe(200)
  })
})

/* ------------------- POST /users/[id]/reset-password ---------------------- */

describe("POST /api/admin/users/[userId]/reset-password — guard", () => {
  it("returns 401 when unauthenticated", async () => {
    authUser = null

    const res = await RESET(new Request("http://localhost"), routeParams(TARGET_ID))

    expect(res.status).toBe(401)
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller is not admin/super_admin", async () => {
    responseQueue = [{ data: { id: ADMIN_ID, role: "student", tenant_id: "tenant-1" } }]

    const res = await RESET(new Request("http://localhost"), routeParams(TARGET_ID))

    expect(res.status).toBe(403)
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it("returns 404 when the target belongs to another tenant", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, email: "x@y.com", tenant_id: "tenant-OTHER" } },
    ]

    const res = await RESET(new Request("http://localhost"), routeParams(TARGET_ID))

    expect(res.status).toBe(404)
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it("triggers recovery without exposing the link, and audits", async () => {
    responseQueue = [
      { data: adminProfile },
      { data: { id: TARGET_ID, email: "target@tenant.com", tenant_id: "tenant-1" } },
    ]
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: "https://secret-link" } },
      error: null,
    })

    const res = await RESET(new Request("http://localhost"), routeParams(TARGET_ID))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true })
    expect(JSON.stringify(json)).not.toContain("secret-link")
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "target@tenant.com",
    })
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.password_reset_requested",
        targetType: "user",
        targetId: TARGET_ID,
      }),
    )
  })
})
