import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Story 2 — Dashboard do gestor escopado por time.
 *
 * Integration tests for `GET /api/analytics/manager` proving the TEAM scope is
 * applied at the application layer (defense in depth, AC6) and that the security
 * normalization (AC4/AC6) NEVER fails open to tenant-wide:
 *   • manager with team members → every student-bearing query carries
 *     `.in("student_id", teamIds)` (AC2) and the union of N teams is used (AC3);
 *   • manager whose `getManagedTeamStudentIds` returns `[]` → zeroed payload (AC4);
 *   • manager whose `getManagedTeamStudentIds` returns `null` → zeroed payload,
 *     NEVER tenant-wide (AC6 — the leak the epic combats).
 */

/* --------- mocks --------- */

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockGetManagedTeamStudentIds = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}))

vi.mock("@/lib/area-context", () => ({
  getManagedTeamStudentIds: (...args: unknown[]) => mockGetManagedTeamStudentIds(...args),
}))

/* --------- helpers --------- */

const MANAGER = "manager-1"
const TENANT = "tenant-1"

type InCall = { table: string; col: string; vals: unknown[] }

/**
 * A chainable, awaitable Supabase stub. Every terminal query resolves to
 * `{ data: [], count: 0 }`. Records each `.in(col, vals)` so tests can assert
 * the team scope is applied to student-bearing tables. `from("users")` returns
 * the manager profile row (role=manager) so the route's auth gate passes.
 */
function makeSupabaseStub() {
  const inCalls: InCall[] = []
  const fromTables: string[] = []

  // Chainable, awaitable query stub. Explicit type breaks the self-referential
  // inference cycle (builder is referenced inside its own initializer) and keeps
  // the native promise `then` so we never declare a literal `then` key.
  type Builder = Promise<{ data: unknown[]; count: number; error: null }> & {
    select: () => Builder
    eq: () => Builder
    gte: () => Builder
    not: () => Builder
    limit: () => Builder
    maybeSingle: () => Promise<{ data: null; error: null }>
    in: (col: string, vals: unknown[]) => Builder
    single: () => Promise<{ data: unknown; error: null }>
  }

  function builder(table: string): Builder {
    // The builder IS an awaitable promise (resolves to empty data / zero count
    // for any non-single query), with the chainable query methods attached via
    // Object.assign so the native `then` is reused — avoids a literal `then`
    // key (biome's noThenProperty). Mirrors the S1 area-context test stub.
    const chain = () => b
    const b: Builder = Object.assign(
      Promise.resolve({ data: [] as unknown[], count: 0, error: null }),
      {
        select: vi.fn(chain),
        eq: vi.fn(chain),
        gte: vi.fn(chain),
        not: vi.fn(chain),
        limit: vi.fn(chain),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        in: vi.fn((col: string, vals: unknown[]) => {
          inCalls.push({ table, col, vals })
          return b
        }),
        // Terminal accessor for the profile lookup (role gate).
        single: vi.fn(async () =>
          table === "users"
            ? { data: { role: "manager", tenant_id: TENANT }, error: null }
            : { data: null, error: null },
        ),
      },
    )
    return b
  }

  mockFrom.mockImplementation((table: string) => {
    fromTables.push(table)
    return builder(table)
  })

  return { inCalls, fromTables }
}

function studentInCalls(inCalls: InCall[]): InCall[] {
  return inCalls.filter((c) => c.col === "student_id")
}

function buildRequest() {
  return new Request("http://localhost/api/analytics/manager?period=30d", { method: "GET" })
}

/* --------- tests --------- */

describe("GET /api/analytics/manager — team scope", () => {
  let handler: typeof import("../route").GET

  beforeEach(async () => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    mockGetManagedTeamStudentIds.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: MANAGER } } })

    const mod = await import("../route")
    handler = mod.GET
  })

  it("scopes every student-bearing query to the team ids (AC2)", async () => {
    const { inCalls } = makeSupabaseStub()
    mockGetManagedTeamStudentIds.mockResolvedValue(["s1", "s2", "s3"])

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)

    // The primitive was resolved with the authenticated manager's id + tenant.
    expect(mockGetManagedTeamStudentIds).toHaveBeenCalledWith(expect.anything(), TENANT, MANAGER)

    // At least the core summary/chart queries carry the team filter, and EVERY
    // student_id filter uses exactly the resolved team scope (no broader set).
    const studentScopeCalls = studentInCalls(inCalls)
    expect(studentScopeCalls.length).toBeGreaterThanOrEqual(5)
    for (const call of studentScopeCalls) {
      expect(call.vals).toEqual(["s1", "s2", "s3"])
    }
  })

  it("uses the deduplicated UNION of N teams as returned by the primitive (AC3)", async () => {
    const { inCalls } = makeSupabaseStub()
    // S1 already de-dupes across teams; the route must consume the value as-is.
    mockGetManagedTeamStudentIds.mockResolvedValue(["s1", "s2"])

    await handler(buildRequest())

    const studentScopeCalls = studentInCalls(inCalls)
    expect(studentScopeCalls.length).toBeGreaterThan(0)
    for (const call of studentScopeCalls) {
      expect(call.vals).toEqual(["s1", "s2"])
    }
  })

  it("returns a zeroed payload when the manager owns team(s) with zero members (AC4)", async () => {
    const { inCalls } = makeSupabaseStub()
    mockGetManagedTeamStudentIds.mockResolvedValue([])

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toEqual({
      summary: { activeStudents: 0, engagementRate: 0, completionRate: 0, sessionsThisMonth: 0 },
      engagementChart: [],
      courseTable: [],
    })
    // Hard guarantee: no analytics query ran — empty scope short-circuits.
    expect(studentInCalls(inCalls)).toHaveLength(0)
  })

  it("collapses null to an EMPTY scope — never tenant-wide (AC6, the leak the epic combats)", async () => {
    const { inCalls } = makeSupabaseStub()
    // `null` = "no team scope". For a manager this MUST mean zero data.
    mockGetManagedTeamStudentIds.mockResolvedValue(null)

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toEqual({
      summary: { activeStudents: 0, engagementRate: 0, completionRate: 0, sessionsThisMonth: 0 },
      engagementChart: [],
      courseTable: [],
    })
    // No tenant-wide fan-out: zero student queries, zero leakage.
    expect(studentInCalls(inCalls)).toHaveLength(0)
  })

  it("still rejects non-manager roles with 403 (AC5 — unchanged)", async () => {
    mockFrom.mockImplementation((table: string) => {
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = vi.fn(chain)
      b.eq = vi.fn(chain)
      b.single = vi.fn(async () =>
        table === "users"
          ? { data: { role: "instructor", tenant_id: TENANT }, error: null }
          : { data: null, error: null },
      )
      return b
    })

    const res = await handler(buildRequest())
    expect(res.status).toBe(403)
    // The team primitive is never consulted for a forbidden role.
    expect(mockGetManagedTeamStudentIds).not.toHaveBeenCalled()
  })
})
