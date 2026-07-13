import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// E3 — resolveAudienceScoped + nudgeEfficacyByType scope tests (non-leakage).
// Proves the intersection trava: a caller can NEVER resolve/aggregate a student
// outside their reach, even if the criteria/tenant asks for something wider.
// ---------------------------------------------------------------------------

const mockResolveCallerStudentScope = vi.fn()
vi.mock("@/lib/area-context", () => ({
  resolveCallerStudentScope: (...a: unknown[]) => mockResolveCallerStudentScope(...a),
}))

import { resolveAudienceScoped } from "../audiences"
import { nudgeEfficacyByType } from "../efficacy"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "11111111-1111-1111-1111-111111111111"

type Row = Record<string, unknown>

/** Minimal chainable service-client stub resolving per table. */
function makeDb(byTable: Record<string, Row[]>) {
  // biome-ignore lint/suspicious/noExplicitAny: minimal chainable stub
  const from = (table: string): any => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      not: () => builder,
      range: () => Promise.resolve({ data: byTable[table] ?? [], error: null }),
    }
    return builder
  }
  // biome-ignore lint/suspicious/noExplicitAny: cast to loose client
  return { from } as any
}

describe("resolveAudienceScoped — non-leakage intersection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("intersects criteria with the manager scope (drops out-of-reach students)", async () => {
    // Criteria (risk=inactive) resolves to s1,s2,s3 tenant-wide; but the caller
    // only reaches s1,s2 → s3 (foreign) MUST be dropped.
    mockResolveCallerStudentScope.mockResolvedValue(["s1", "s2"])
    const db = makeDb({
      users: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      sessions: [], // no sessions → all "never_accessed", but risk=inactive needs sessions
      slide_reflections: [],
    })
    // risk=never_accessed matches the no-session students s1,s2,s3.
    const result = await resolveAudienceScoped(
      db,
      TENANT,
      USER,
      ["manager"],
      { risk: "never_accessed" },
      db,
    )
    expect(result.sort()).toEqual(["s1", "s2"]) // s3 dropped by scope
  })

  it("admin scope (null) passes the criteria set through tenant-wide", async () => {
    mockResolveCallerStudentScope.mockResolvedValue(null)
    const db = makeDb({
      users: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      sessions: [],
      slide_reflections: [],
    })
    const result = await resolveAudienceScoped(
      db,
      TENANT,
      USER,
      ["admin"],
      { risk: "never_accessed" },
      db,
    )
    expect(result.sort()).toEqual(["s1", "s2", "s3"])
  })

  it("fail-closed: empty caller scope yields empty audience", async () => {
    mockResolveCallerStudentScope.mockResolvedValue([])
    const db = makeDb({
      users: [{ id: "s1" }, { id: "s2" }],
      sessions: [],
      slide_reflections: [],
    })
    const result = await resolveAudienceScoped(
      db,
      TENANT,
      USER,
      ["manager"],
      { risk: "never_accessed" },
      db,
    )
    expect(result).toEqual([])
  })
})

describe("nudgeEfficacyByType — scope", () => {
  it("fail-closed: empty scope returns no metrics", async () => {
    const db = makeDb({ notifications: [{ template_id: "t1", sent_at: "x", returned_at: null }] })
    const result = await nudgeEfficacyByType(TENANT, db, [])
    expect(result).toEqual([])
  })

  it("null scope aggregates tenant-wide", async () => {
    const db = makeDb({
      notifications: [
        { template_id: "t1", sent_at: "x", returned_at: "y" },
        { template_id: "t1", sent_at: "x", returned_at: null },
      ],
      notification_templates: [{ id: "t1", key: "never_accessed" }],
    })
    const result = await nudgeEfficacyByType(TENANT, db, null)
    expect(result).toHaveLength(1)
    expect(result[0].sent).toBe(2)
    expect(result[0].returned).toBe(1)
    expect(result[0].returnRatePct).toBe(50)
  })
})
