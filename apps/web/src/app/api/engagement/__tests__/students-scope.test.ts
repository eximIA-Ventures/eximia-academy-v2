import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// GET /api/engagement/students — scope coherence (Sheet <-> page).
//
// The Individual Action Sheet (E6) consumes THIS route. The reported bug: an
// admin who ALSO holds the manager hat and is viewing "as Gestor"
// (x-role-lens=manager) saw the page resolve a real recorte (organization pill,
// N alunos) but the Sheet then denied a student that WAS in that recorte —
// because resolveEngagementScope short-circuited the admin hat to tenant-wide
// (null) and ignored the active lens. These tests pin BOTH readings of the same
// caller so page and route can never disagree again:
//
//   1. admin acting AS ADMIN (no manager lens) → tenant-wide (null): EVERY
//      requested id is returned, none dropped.
//   2. admin+manager acting AS MANAGER (x-role-lens=manager) → the manager
//      SUBTREE: an in-subtree student IS returned; an out-of-subtree student is
//      silently dropped (never leaked).
//
// The REAL resolveEngagementScope + area-context run; only the DB primitives and
// the lens/context cookies are mocked (mirrors canonical-scope.test.ts).
// ===========================================================================

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockRoleLensCookie = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
// Not a `team` active context → the manager branch uses the whole subtree.
vi.mock("@/lib/context-context", () => ({
  getActiveContextCookie: () => Promise.resolve(null),
}))
vi.mock("@/lib/team-view-context", () => ({
  getTeamViewMode: () => Promise.resolve("hierarchy"),
}))
vi.mock("@/lib/role-lens-context", () => ({
  getRoleLensCookie: () => mockRoleLensCookie(),
}))

const mockServiceFrom = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { GET as studentsGET } from "../students/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ADMIN = "11111111-1111-1111-1111-111111111111"
const IN_SUBTREE = "22222222-2222-2222-2222-222222222222"
const OUT_OF_SUBTREE = "99999999-9999-9999-9999-999999999999"

// The authenticated client the students route hands to resolveEngagementScope.
// Only `auth_reachable_student_ids` (the subtree RPC) is exercised here.
function authClient(subtree: string[]) {
  return {
    rpc: (name: string) =>
      name === "auth_reachable_student_ids"
        ? Promise.resolve({ data: subtree, error: null })
        : Promise.resolve({ data: [], error: null }),
  }
}

// The service reads: users/sessions/slide_reflections/enrollments each resolve
// via .select().eq()...(.in) → the `users` table returns a roster row for every
// id the route actually queried (i.e. the ids that survived the scope). We echo
// back the requested ids as students so "returned" == "in scope".
function stubServiceReads() {
  mockServiceFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) =>
                Promise.resolve({
                  data: ids.map((id) => ({ id, full_name: `Aluno ${id.slice(0, 4)}` })),
                  error: null,
                }),
            }),
          }),
        }),
      }
    }
    // sessions / slide_reflections / enrollments → empty, shape .select().eq().in()
    return {
      select: () => ({
        eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }
  })
}

function studentsReq(ids: string[], action = "recognize"): Request {
  const q = new URLSearchParams({ ids: ids.join(","), action })
  return new Request(`http://localhost/api/engagement/students?${q.toString()}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveTenantId.mockResolvedValue(TENANT)
  stubServiceReads()
})

describe("GET /api/engagement/students — admin acting AS ADMIN (tenant-wide)", () => {
  it("returns EVERY requested id (null scope = no restriction), none dropped", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: ADMIN },
      profile: { tenant_id: TENANT, full_name: "R" },
      // Holds only admin OR admin without the manager lens active.
      roles: ["admin"],
      supabase: authClient([]),
    })
    mockRoleLensCookie.mockResolvedValue(null) // no lens → admin acts as admin

    const res = await studentsGET(studentsReq([IN_SUBTREE, OUT_OF_SUBTREE]))
    expect(res.status).toBe(200)
    const json = await res.json()
    const returnedIds = json.students.map((s: { id: string }) => s.id).sort()
    expect(returnedIds).toEqual([IN_SUBTREE, OUT_OF_SUBTREE].sort())
  })
})

describe("GET /api/engagement/students — admin+manager acting AS MANAGER (lens)", () => {
  it("scopes to the manager subtree: in-subtree student returned, out-of-subtree dropped", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: ADMIN },
      profile: { tenant_id: TENANT, full_name: "R" },
      // The SAME caller as the page: holds BOTH hats.
      roles: ["admin", "manager"],
      // The authenticated client's subtree RPC returns ONLY the in-subtree id.
      supabase: authClient([IN_SUBTREE]),
    })
    mockRoleLensCookie.mockResolvedValue("manager") // viewing "as Gestor"

    // The composer asks for the student it clicked (in the page's recorte).
    const res = await studentsGET(studentsReq([IN_SUBTREE]))
    expect(res.status).toBe(200)
    const json = await res.json()
    // The in-subtree student IS returned — this is the reported bug: it used to
    // be denied because the admin hat forced tenant-wide and the manager lens was
    // ignored. (Here tenant-wide would ALSO return it, so we also prove the drop.)
    expect(json.students.map((s: { id: string }) => s.id)).toEqual([IN_SUBTREE])

    // And an out-of-subtree student is silently dropped (never leaked) — proving
    // the caller is genuinely subtree-scoped, NOT tenant-wide, under the lens.
    const res2 = await studentsGET(studentsReq([OUT_OF_SUBTREE]))
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.students).toEqual([])
  })
})

// ===========================================================================
// SEARCH mode (?q=) — the manual picker of the Central de Envios. The picker
// must ONLY ever list students of the caller's current recorte. These tests pin
// that the name search is bounded by the SAME scope:
//   1. a MANAGER's search is `.in()`-bound to the subtree (never tenant-wide).
//   2. an ADMIN's search never binds `.in()` (tenant-wide is legitimate for them).
//   3. a fail-closed ([]) scope returns empty WITHOUT touching the DB.
// ===========================================================================

// A `users` search stub for the ?q= path: select().eq().eq().ilike().[in()].
// order().limit(). Records whether `.in()` was called and with which ids, then
// echoes the configured rows. Everything is chainable + thenable at .limit().
function stubSearchReads(rows: Array<{ id: string; full_name: string | null }>) {
  const capture: { inCalled: boolean; inIds: string[] | null } = { inCalled: false, inIds: null }
  mockServiceFrom.mockImplementation((table: string) => {
    if (table !== "users") throw new Error(`unexpected table ${table}`)
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.ilike = () => builder
    builder.in = (_col: string, ids: string[]) => {
      capture.inCalled = true
      capture.inIds = ids
      return builder
    }
    builder.order = () => builder
    builder.limit = () => Promise.resolve({ data: rows, error: null })
    return builder
  })
  return capture
}

function searchReq(q: string): Request {
  const params = new URLSearchParams({ q })
  return new Request(`http://localhost/api/engagement/students?${params.toString()}`)
}

describe("GET /api/engagement/students?q= — manual picker scope", () => {
  it("MANAGER search is bounded to the subtree via .in() (never tenant-wide)", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: ADMIN },
      profile: { tenant_id: TENANT, full_name: "R" },
      roles: ["manager"],
      supabase: authClient([IN_SUBTREE]),
    })
    mockRoleLensCookie.mockResolvedValue("manager")
    const capture = stubSearchReads([{ id: IN_SUBTREE, full_name: "Marcela Souza" }])

    const res = await studentsGET(searchReq("mar"))
    expect(res.status).toBe(200)
    const json = await res.json()
    // The search is scope-bound: `.in()` was called with exactly the subtree.
    expect(capture.inCalled).toBe(true)
    expect(capture.inIds).toEqual([IN_SUBTREE])
    // Light option shape (id + fullName), not the heavy detail projection.
    expect(json.students).toEqual([{ id: IN_SUBTREE, fullName: "Marcela Souza" }])
  })

  it("ADMIN acting AS ADMIN search is tenant-wide: .in() is never called", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: ADMIN },
      profile: { tenant_id: TENANT, full_name: "R" },
      roles: ["admin"],
      supabase: authClient([]),
    })
    mockRoleLensCookie.mockResolvedValue(null) // admin acts as admin
    const capture = stubSearchReads([{ id: OUT_OF_SUBTREE, full_name: "Aluno Qualquer" }])

    const res = await studentsGET(searchReq("alu"))
    expect(res.status).toBe(200)
    // No `.in()` narrowing — the tenant-scoped query (eq tenant_id) is the bound.
    expect(capture.inCalled).toBe(false)
  })

  it("fail-closed: a manager who reaches no one gets [] without hitting the DB", async () => {
    mockGetAuthProfile.mockResolvedValue({
      user: { id: ADMIN },
      profile: { tenant_id: TENANT, full_name: "R" },
      roles: ["manager"],
      supabase: authClient([]), // subtree RPC returns nothing → scope = []
    })
    mockRoleLensCookie.mockResolvedValue("manager")
    // If the route were to query, this would throw (proving it short-circuits).
    mockServiceFrom.mockImplementation(() => {
      throw new Error("must not query the DB on an empty scope")
    })

    const res = await studentsGET(searchReq("mar"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.students).toEqual([])
  })
})
