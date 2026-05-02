import { beforeEach, describe, expect, it, vi } from "vitest"

/* --------- Supabase mocks --------- */
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn().mockReturnValue({
    rpc: (fn: string, params: Record<string, unknown>) => mockRpc(fn, params),
    auth: { admin: { updateUserById: (...args: unknown[]) => mockUpdateUserById(...args) } },
  }),
}))

/* --------- helpers --------- */

function buildRequest(body: unknown, userId?: string) {
  const url = userId
    ? `http://localhost/api/privacy/delete?userId=${userId}`
    : "http://localhost/api/privacy/delete"

  return new Request(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }
}

/* --------- tests --------- */

describe("DELETE /api/privacy/delete", () => {
  let handler: typeof import("../delete/route").DELETE

  beforeEach(async () => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    mockRpc.mockReset()
    mockUpdateUserById.mockReset()

    const mod = await import("../delete/route")
    handler = mod.DELETE
  })

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when confirm is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const res = await handler(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 when body is not JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const req = new Request("http://localhost/api/privacy/delete", {
      method: "DELETE",
      body: "not json",
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it("returns 404 when caller profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain(null))

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(404)
  })

  it("returns 403 when non-admin tries to delete another user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "student", tenant_id: "t1" }))

    const res = await handler(buildRequest({ confirm: true }, "u2"))
    expect(res.status).toBe(403)
  })

  it("returns 400 when admin tries to delete themselves", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "admin", tenant_id: "t1" }))

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(400)
  })

  it("returns 403 when admin targets user from different tenant", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin1" } } })

    // First call: caller profile
    const callerChain = mockChain({ id: "admin1", role: "admin", tenant_id: "t1" })
    // Second call: target profile
    const targetChain = mockChain({ id: "u2", tenant_id: "t2" })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? callerChain : targetChain
    })

    const res = await handler(buildRequest({ confirm: true }, "u2"))
    expect(res.status).toBe(403)
  })

  it("returns 500 when rpc fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "student", tenant_id: "t1" }))
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } })

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain("DB error")
  })

  it("returns 200 on successful self-delete (student)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "student", tenant_id: "t1" }))
    mockRpc.mockResolvedValue({ data: "2026-02-08T00:00:00Z", error: null })
    mockUpdateUserById.mockResolvedValue({ error: null })

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.deleted_user_id).toBe("u1")
    expect(body.deleted_at).toBe("2026-02-08T00:00:00Z")
  })

  it("calls rpc with lgpd_soft_delete_user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "student", tenant_id: "t1" }))
    mockRpc.mockResolvedValue({ data: "2026-02-08T00:00:00Z", error: null })
    mockUpdateUserById.mockResolvedValue({ error: null })

    await handler(buildRequest({ confirm: true }))

    expect(mockRpc).toHaveBeenCalledWith("lgpd_soft_delete_user", { p_user_id: "u1" })
  })

  it("returns 207 with warning when ban fails (partial failure)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockFrom.mockReturnValue(mockChain({ id: "u1", role: "student", tenant_id: "t1" }))
    mockRpc.mockResolvedValue({ data: "2026-02-08T00:00:00Z", error: null })
    mockUpdateUserById.mockResolvedValue({ error: { message: "Auth service down" } })

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await handler(buildRequest({ confirm: true }))
    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.warning).toBe("auth_ban_failed")
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
