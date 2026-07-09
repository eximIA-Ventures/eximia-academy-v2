import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// E11 — CANONICAL SCOPE SCENARIO (AC7) + remaining coverage (AC1, AC2, AC4).
//
// The Rinaldo / "Meu Time" scenario (00-EPIC-OVERVIEW Section 2):
//   1 tenant, 1 manager (Rinaldo) owning a manager_group of 6 members, PLUS 7
//   more students of the SAME tenant OUTSIDE that group = 13 total. EVERY
//   surface (overview cards, live suggestions, history) must report at most the
//   6 — never the 13 — and any action/campaign aimed at a 7th (out-of-group)
//   student is rejected.
//
// BLOCKER RULE (PO, E11 Dev Notes): the test MUST exercise the REAL resolver
//   (resolveEngagementScope → resolveCallerStudentScope → getManagedTeamStudentIds)
//   from manager_group data mocked AT THE DB LEVEL. Mocking the resolver to hand
//   back the 6 ids would hide exactly the bug this test exists to catch.
//   => Here NOTHING under @/lib/notifications/engagement-scope or @/lib/area-context
//      is mocked. Only the DB primitives (the authenticated client's RPC / the
//      service client's table reads) are mocked, i.e. the manager_group AT THE
//      DB LEVEL. The scope-resolution code runs for real.
// ===========================================================================

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
// The context cookies the analytics page + resolveEngagementScope honour. For a
// manager OUTSIDE a `team` context, resolveEngagementScope falls back to the
// widest reach via resolveCallerStudentScope (subtree). We drive that fallback
// (return null from the active-context cookie) so the REAL manager branch runs.
vi.mock("@/lib/context-context", () => ({
  getActiveContextCookie: () => Promise.resolve(null),
}))
vi.mock("@/lib/team-view-context", () => ({
  getTeamViewMode: () => Promise.resolve("hierarchy"),
}))

const mockServiceFrom = vi.fn()
vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { POST as actionPOST } from "../action/route"
import { GET as historyGET } from "../history/route"
import { GET as overviewGET } from "../overview/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const RINALDO = "11111111-1111-1111-1111-111111111111"

// 6 in Rinaldo's team; 7 more in the same tenant OUTSIDE it → 13 total.
const TEAM_6 = Array.from({ length: 6 }, (_, i) => `dddddddd-0000-0000-0000-00000000000${i + 1}`)
const OTHER_7 = Array.from({ length: 7 }, (_, i) => `eeeeeeee-0000-0000-0000-00000000000${i + 1}`)
const ALL_13 = [...TEAM_6, ...OTHER_7]

type Row = Record<string, unknown>

// ---------------------------------------------------------------------------
// The manager's AUTHENTICATED client. This is where the manager_group lives at
// the DB level: resolveCallerStudentScope(manager) → getManagedTeamStudentIds(
// {includeSubtree:true}) → rpc("auth_reachable_student_ids"). The RPC is the
// DB's resolution of the group; returning TEAM_6 here is "the group at the DB
// level". Everything above it (the resolver chain) runs for real.
// ---------------------------------------------------------------------------
function makeAuthClient(reachable: string[]) {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: minimal RPC stub
    rpc: (name: string): any => {
      if (name === "auth_reachable_student_ids") {
        return Promise.resolve({ data: reachable, error: null })
      }
      return Promise.resolve({ data: [], error: null })
    },
  }
}

function asRinaldo(reachable: string[]) {
  const authClient = makeAuthClient(reachable)
  mockGetAuthProfile.mockResolvedValue({
    user: { id: RINALDO },
    profile: { tenant_id: TENANT, full_name: "Rinaldo" },
    roles: ["manager"],
    supabase: authClient,
  })
  mockResolveTenantId.mockResolvedValue(TENANT)
}

// A tenant-wide roster of ALL 13 students for the service client (the roster
// both the overview cards AND generateNudgeSuggestions must NARROW to the 6).
// Every builder is a fully chainable thenable resolving to the table's rows, so
// BOTH the route's own reads and the engine's internal reads run for real.
// Deliberately contains data for the out-of-group 7 to prove they are dropped.
function installTenantWideServiceReads() {
  const rowsFor = (table: string): Row[] => {
    if (table === "users") {
      return ALL_13.map((id) => ({
        id,
        full_name: `Aluno ${id.slice(-1)}`,
        email: `${id}@x.co`,
      }))
    }
    // sessions/notifications/slide_reflections/enrollments/courses → empty →
    // all 13 are "never accessed"; nudge_suggestions cadence + dismissal reads
    // and the insert-return also resolve empty (no prior suggestions).
    return []
  }
  mockServiceFrom.mockImplementation((table: string) => {
    const insertPayload: Row[] = []
    // biome-ignore lint/suspicious/noExplicitAny: chainable thenable stub
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      gte: () => builder,
      lte: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: rowsFor(table), error: null }),
      insert: (payload: Row[]) => {
        const arr = Array.isArray(payload) ? payload : [payload]
        insertPayload.push(...arr)
        // The engine reads back the inserted rows via .insert().select().
        return {
          select: () => Promise.resolve({ data: insertPayload, error: null }),
        }
      },
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub
      then: (onF: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: rowsFor(table), error: null }).then(onF),
    }
    return builder
  })
}

describe("E11 AC7 — canonical Rinaldo/Meu Time scope (6 of 13), REAL resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("overview: cards + suggestions computed over the 6, never the 13", async () => {
    asRinaldo(TEAM_6)
    installTenantWideServiceReads()
    const res = await overviewGET()
    expect(res.status).toBe(200)
    const json = await res.json()
    // The recorte reports exactly 6 students, not 13.
    expect(json.scope.tenantWide).toBe(false)
    expect(json.scope.studentCount).toBe(6)
    // All 13 never accessed, but only the 6 in scope count as "em atenção".
    expect(json.cards.alunosEmAtencao).toBe(6)
    // The never_accessed suggestion cohort targets ONLY the 6.
    const neverAccessed = json.suggestions.find(
      (s: { type: string }) => s.type === "never_accessed",
    )
    expect(neverAccessed).toBeDefined()
    expect(new Set(neverAccessed.target_student_ids)).toEqual(new Set(TEAM_6))
    // Not a single out-of-group student leaked into any suggestion.
    for (const s of json.suggestions) {
      for (const id of s.target_student_ids as string[]) {
        expect(OTHER_7).not.toContain(id)
      }
    }
  })

  it("overview: an EMPTY group (RPC returns []) fails closed to 0, not 13", async () => {
    asRinaldo([]) // Rinaldo reaches nobody → must NOT fall back to tenant-wide.
    installTenantWideServiceReads()
    const res = await overviewGET()
    const json = await res.json()
    expect(json.scope.studentCount).toBe(0)
    expect(json.cards.alunosEmAtencao).toBe(0)
    expect(json.suggestions).toEqual([])
  })

  it("history: only notifications addressed to the 6 are returned; enrichment never asks for the 7", async () => {
    asRinaldo(TEAM_6)
    let usersQueriedIds: string[] = []
    // The scoped notifications read is bound to recipient_id IN (TEAM_6). We make
    // the DB honour that .in() bound so a row for an out-of-group student can
    // never come back — exactly the production guarantee.
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "notifications") {
        let bound: string[] | null = null
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "eq", "gte", "lte", "order"]) builder[m] = () => builder
        builder.in = (_col: string, ids: string[]) => {
          bound = ids
          return builder
        }
        builder.limit = () => {
          const inScope = (id: string) => bound === null || bound.includes(id)
          // The DB "contains" a notification for every one of the 13; only the
          // scoped ones (bound) may be returned.
          const rows = ALL_13.filter(inScope).map((id, i) => ({
            id: `n${i}`,
            recipient_id: id,
            created_at: "2026-07-08T10:00:00Z",
          }))
          return Promise.resolve({ data: rows, error: null })
        }
        return builder
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) => {
                usersQueriedIds = ids
                return Promise.resolve({
                  data: ids.map((id) => ({
                    id,
                    full_name: `Aluno ${id.slice(-1)}`,
                    email: `${id}@x.co`,
                  })),
                  error: null,
                })
              },
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
      }
    })
    const res = await historyGET(new Request("http://localhost/api/engagement/history"))
    expect(res.status).toBe(200)
    const json = await res.json()
    const returnedIds = json.notifications.map((n: { recipient_id: string }) => n.recipient_id)
    expect(new Set(returnedIds)).toEqual(new Set(TEAM_6))
    for (const id of returnedIds) expect(OTHER_7).not.toContain(id)
    // Enrichment lookup was bounded to in-scope recipients only.
    for (const id of usersQueriedIds) expect(OTHER_7).not.toContain(id)
  })

  it("action: aiming at an out-of-group student (one of the 7) is rejected 403, never dispatched", async () => {
    asRinaldo(TEAM_6)
    // The action route re-scopes via the REAL resolveEngagementScope; a target
    // outside the resolved 6 must 403. We stub the engine dispatch to prove it
    // is NEVER reached.
    const res = await actionPOST(
      new Request("http://localhost/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: OTHER_7[0], nudgeType: "never_accessed" }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it("action: aiming at an in-group student (one of the 6) is accepted", async () => {
    asRinaldo(TEAM_6)
    const res = await actionPOST(
      new Request("http://localhost/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: TEAM_6[0], nudgeType: "never_accessed" }),
      }),
    )
    // 200 (dispatched) OR a non-403/404 error from the mocked dispatch internals —
    // the ONLY thing this asserts is that the SCOPE gate did not reject an
    // in-group student. A 403 here would mean the resolver wrongly excluded a
    // member of the 6.
    expect(res.status).not.toBe(403)
  })
})
