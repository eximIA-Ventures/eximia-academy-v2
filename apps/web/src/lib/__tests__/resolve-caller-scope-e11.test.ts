import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// E11 AC4 — resolveCallerStudentScope over its 4 profiles, exercised for REAL.
// Only the DB primitives (RPC / table reads) and the instructor-area lookup are
// mocked; the branch logic of resolveCallerStudentScope runs unmocked.
//
// PLUS the LITERAL "manager_group at the DB level": getManagedTeamStudentIds
// DEFAULT branch (no subtree) reading manager_groups + manager_group_members.
// ===========================================================================

const mockGetInstructorAreaIds = vi.fn()
vi.mock("@/lib/api-auth/instructor-permissions", () => ({
  getInstructorAreaIds: (u: string, t: string) => mockGetInstructorAreaIds(u, t),
}))

import { getManagedTeamStudentIds, resolveCallerStudentScope } from "../area-context"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "11111111-1111-1111-1111-111111111111"
const AREA = "22222222-2222-2222-2222-222222222222"

type Row = Record<string, unknown>

// A per-table + RPC mock client. `rpc` returns the reachable set for the manager
// subtree branch; `from(table)` resolves table reads by name.
function makeDb(opts: {
  rpc?: Record<string, string[]>
  tables?: Record<string, Row[]>
  captureIn?: (table: string, col: string, ids: string[]) => void
}) {
  // biome-ignore lint/suspicious/noExplicitAny: minimal chainable stub
  const from = (table: string): any => {
    const builder: Record<string, unknown> = {}
    for (const m of ["select", "eq"]) builder[m] = () => builder
    builder.in = (col: string, ids: string[]) => {
      opts.captureIn?.(table, col, ids)
      return builder
    }
    // Terminal: awaiting the builder resolves to the table's rows.
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub
    builder.then = (onF: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: opts.tables?.[table] ?? [], error: null }).then(onF)
    return builder
  }
  return {
    from,
    rpc: (name: string) => Promise.resolve({ data: opts.rpc?.[name] ?? [], error: null }),
    // biome-ignore lint/suspicious/noExplicitAny: cast to loose client
  } as any
}

describe("E11 AC4 — resolveCallerStudentScope, 4 profiles (REAL)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("admin → null (tenant-wide), no DB touched", async () => {
    const db = makeDb({})
    expect(await resolveCallerStudentScope(db, TENANT, USER, ["admin"])).toBeNull()
  })

  it("super_admin → null (tenant-wide)", async () => {
    const db = makeDb({})
    expect(await resolveCallerStudentScope(db, TENANT, USER, ["super_admin"])).toBeNull()
  })

  it("manager → own subtree via auth_reachable_student_ids RPC (deduped)", async () => {
    const db = makeDb({ rpc: { auth_reachable_student_ids: ["s1", "s2", "s2", "s3"] } })
    const scope = await resolveCallerStudentScope(db, TENANT, USER, ["manager"])
    expect(scope?.sort()).toEqual(["s1", "s2", "s3"])
  })

  it("instructor → union of area students (fail-closed [] when no areas)", async () => {
    mockGetInstructorAreaIds.mockResolvedValue([AREA])
    const db = makeDb({
      tables: {
        user_areas: [{ user_id: "s1" }, { user_id: "s2" }],
        users: [{ id: "s1" }, { id: "s2" }],
      },
    })
    const scope = await resolveCallerStudentScope(db, TENANT, USER, ["instructor"])
    expect(scope?.sort()).toEqual(["s1", "s2"])

    // No assigned areas → fail-closed [].
    mockGetInstructorAreaIds.mockResolvedValue([])
    expect(await resolveCallerStudentScope(makeDb({}), TENANT, USER, ["instructor"])).toEqual([])
  })

  it("any other hat (student) → [] fail-closed, NEVER tenant-wide", async () => {
    const db = makeDb({})
    expect(await resolveCallerStudentScope(db, TENANT, USER, ["student"])).toEqual([])
    expect(await resolveCallerStudentScope(db, TENANT, USER, [])).toEqual([])
  })
})

describe("E11 — manager_group at the DB level (getManagedTeamStudentIds DEFAULT branch)", () => {
  it("resolves members from manager_groups + manager_group_members tables (6 members)", async () => {
    const SIX = Array.from({ length: 6 }, (_, i) => `m${i + 1}`)
    let membersQueriedGroupIds: string[] = []
    const db = makeDb({
      tables: {
        manager_groups: [{ id: "g1" }],
        manager_group_members: SIX.map((student_id) => ({ student_id })),
      },
      captureIn: (table, _col, ids) => {
        if (table === "manager_group_members") membersQueriedGroupIds = ids
      },
    })
    // DEFAULT branch (no includeSubtree) → reads the two tables, NOT the RPC.
    const scope = await getManagedTeamStudentIds(db, TENANT, USER)
    expect(scope?.sort()).toEqual([...SIX].sort())
    // Proves the members read was bound to the owned group id.
    expect(membersQueriedGroupIds).toEqual(["g1"])
  })

  it("manager owns no group → null (no team scope)", async () => {
    const db = makeDb({ tables: { manager_groups: [] } })
    expect(await getManagedTeamStudentIds(db, TENANT, USER)).toBeNull()
  })
})
