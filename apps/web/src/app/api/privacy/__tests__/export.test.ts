import { beforeEach, describe, expect, it, vi } from "vitest"

/* --------- Supabase mock --------- */
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}))

/* --------- helpers --------- */

function buildRequest(userId?: string) {
  const url = userId
    ? `http://localhost/api/privacy/export?userId=${userId}`
    : "http://localhost/api/privacy/export"
  return new Request(url, { method: "GET" })
}

function mockSelectSingle(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

function mockSelectMany(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }
}

/* --------- tests --------- */

describe("GET /api/privacy/export", () => {
  let handler: typeof import("../export/route").GET

  beforeEach(async () => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockFrom.mockReset()

    const mod = await import("../export/route")
    handler = mod.GET
  })

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await handler(buildRequest())
    expect(res.status).toBe(401)
  })

  it("returns 404 when caller profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockSelectSingle(null))

    const res = await handler(buildRequest())
    expect(res.status).toBe(404)
  })

  it("returns 403 when non-admin tries to export another user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockSelectSingle({ id: "u1", role: "student", tenant_id: "t1" }))

    const res = await handler(buildRequest("u2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with export payload for self-export", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const userData = { id: "u1", role: "student", tenant_id: "t1", email: "test@test.com" }
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      // Audit log insert
      if (table === "platform_audit_log") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      callCount++
      if (callCount === 1) {
        // Caller profile lookup
        return mockSelectSingle(userData)
      }
      // All subsequent calls (user, enrollments, sessions, messages, analyses)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: userData, error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    })

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty("exported_at")
    expect(body).toHaveProperty("user")
    expect(body).toHaveProperty("enrollments")
    expect(body).toHaveProperty("sessions")
  })

  it("returns 403 when admin exports user from different tenant", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin1" } } })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return mockSelectSingle({ id: "admin1", role: "admin", tenant_id: "t1" })
      }
      return mockSelectSingle({ id: "u2", tenant_id: "t2" })
    })

    const res = await handler(buildRequest("u2"))
    expect(res.status).toBe(403)
  })
})
