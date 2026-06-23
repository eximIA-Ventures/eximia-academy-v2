import { describe, expect, it, vi } from "vitest"
import { getManagedTeamStudentIds } from "../area-context"

const TENANT = "tenant-1"
const MANAGER = "11111111-1111-1111-1111-111111111111"

type Row = Record<string, unknown>

/**
 * Builds a chainable Supabase stub for getManagedTeamStudentIds.
 *
 * Each query is `db.from(table).select(cols).eq(...).eq(...)` (manager_groups)
 * or `.eq(...).in(...)` (manager_group_members). The builder returns a promise
 * (thenable) that resolves to `{ data }` keyed by the table passed to `from()`.
 * It records every `from`/`eq`/`in` call so tests can assert tenant/manager
 * scoping and prove no corporate fan-out (manager_group_units never queried).
 */
function makeDb(byTable: Record<string, Row[] | undefined>) {
  const fromCalls: string[] = []
  const eqCalls: Array<{ table: string; col: string; val: unknown }> = []
  const inCalls: Array<{ table: string; col: string; vals: unknown[] }> = []

  // Chainable, awaitable query stub. Explicit type breaks the self-referential
  // inference cycle (builder is referenced inside its own initializer).
  type Builder = Promise<{ data: Row[] }> & {
    select: () => Builder
    eq: (col: string, val: unknown) => Builder
    in: (col: string, vals: unknown[]) => Builder
  }

  const from = vi.fn((table: string): Builder => {
    fromCalls.push(table)
    const data = byTable[table] ?? []
    // The builder IS the resolved promise (awaitable at any point in the chain),
    // with select/eq/in attached so the chain can continue and still resolve to
    // { data }. Object.assign keeps the native `then`, avoiding a literal then key.
    const builder: Builder = Object.assign(Promise.resolve({ data }), {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: unknown) => {
        eqCalls.push({ table, col, val })
        return builder
      }),
      in: vi.fn((col: string, vals: unknown[]) => {
        inCalls.push({ table, col, vals })
        return builder
      }),
    })
    return builder
  })

  // biome-ignore lint/suspicious/noExplicitAny: minimal stub matching the loosely-typed client param
  return { db: { from } as any, fromCalls, eqCalls, inCalls }
}

describe("getManagedTeamStudentIds", () => {
  it("returns distinct student ids for a manager with 1 team and 3 members (case 1)", async () => {
    const { db, fromCalls, eqCalls, inCalls } = makeDb({
      manager_groups: [{ id: "g1" }],
      manager_group_members: [{ student_id: "s1" }, { student_id: "s2" }, { student_id: "s3" }],
    })

    const result = await getManagedTeamStudentIds(db, TENANT, MANAGER)

    expect(result).not.toBeNull()
    expect([...(result as string[])].sort()).toEqual(["s1", "s2", "s3"])

    // Scope assertions (AC5): groups filtered by tenant + manager.
    expect(eqCalls).toContainEqual({
      table: "manager_groups",
      col: "tenant_id",
      val: TENANT,
    })
    expect(eqCalls).toContainEqual({
      table: "manager_groups",
      col: "manager_id",
      val: MANAGER,
    })
    // Members filtered by tenant + group_id IN (...).
    expect(eqCalls).toContainEqual({
      table: "manager_group_members",
      col: "tenant_id",
      val: TENANT,
    })
    expect(inCalls).toContainEqual({
      table: "manager_group_members",
      col: "group_id",
      vals: ["g1"],
    })
    // AC6 — no corporate fan-out: manager_group_units never consulted.
    expect(fromCalls).not.toContain("manager_group_units")
  })

  it("de-dupes a student that belongs to two of the manager's teams (case 2)", async () => {
    const { db } = makeDb({
      manager_groups: [{ id: "g1" }, { id: "g2" }],
      manager_group_members: [{ student_id: "s1" }, { student_id: "s2" }, { student_id: "s1" }],
    })

    const result = await getManagedTeamStudentIds(db, TENANT, MANAGER)

    expect([...(result as string[])].sort()).toEqual(["s1", "s2"])
  })

  it("returns null when the manager owns no team (case 3)", async () => {
    const { db, fromCalls } = makeDb({ manager_groups: [] })

    const result = await getManagedTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toBeNull()
    // Did not query members once it knows there are no owned groups.
    expect(fromCalls).toContain("manager_groups")
    expect(fromCalls).not.toContain("manager_group_members")
    expect(fromCalls).not.toContain("manager_group_units")
  })

  it("returns [] when the manager owns team(s) with zero members (case 4)", async () => {
    const { db } = makeDb({
      manager_groups: [{ id: "g1" }],
      manager_group_members: [],
    })

    const result = await getManagedTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual([])
  })

  it("returns null without querying when tenantId is empty (case 5)", async () => {
    const { db, fromCalls } = makeDb({ manager_groups: [{ id: "g1" }] })

    const result = await getManagedTeamStudentIds(db, "", MANAGER)

    expect(result).toBeNull()
    expect(fromCalls).toHaveLength(0)
  })

  it("returns null without querying when managerId is not a valid UUID (case 6)", async () => {
    const { db, fromCalls } = makeDb({ manager_groups: [{ id: "g1" }] })

    const result = await getManagedTeamStudentIds(db, TENANT, "not-a-uuid")

    expect(result).toBeNull()
    expect(fromCalls).toHaveLength(0)
  })

  it("returns null without querying when managerId is falsy (case 7)", async () => {
    const { db, fromCalls } = makeDb({ manager_groups: [{ id: "g1" }] })

    expect(await getManagedTeamStudentIds(db, TENANT, null)).toBeNull()
    expect(await getManagedTeamStudentIds(db, TENANT, undefined)).toBeNull()
    expect(await getManagedTeamStudentIds(db, TENANT, "")).toBeNull()
    expect(fromCalls).toHaveLength(0)
  })
})
