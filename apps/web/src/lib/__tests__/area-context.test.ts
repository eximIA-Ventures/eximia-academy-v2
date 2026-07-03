import { describe, expect, it, vi } from "vitest"
import { getDirectTeamStudentIds, getManagedTeamStudentIds } from "../area-context"

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

/**
 * Builds a minimal stub exposing only `db.rpc`, for `getDirectTeamStudentIds`
 * (Iteração 3, 2026-07-02): the whole resolution now happens inside the
 * `auth_direct_student_ids` SQL function (SECURITY DEFINER, reads `user_roles`
 * with elevated privilege to dodge the RLS bug — see area-context.ts docblock),
 * so the JS layer no longer issues `.from(...)` queries for this helper. This
 * mirrors how `getSubtreeStudentIdsAtNode`'s own tests stub `db.rpc`.
 */
function makeRpcDb(
  impl: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
) {
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = []
  const rpc = vi.fn((fn: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    return impl(fn, args)
  })
  // biome-ignore lint/suspicious/noExplicitAny: minimal stub matching the loosely-typed client param
  return { db: { rpc } as any, rpcCalls }
}

describe("getDirectTeamStudentIds", () => {
  it("delegates to auth_direct_student_ids(_node) and returns its rows, deduped (case 1)", async () => {
    const { db, rpcCalls } = makeRpcDb(async () => ({ data: ["s1", "s2", "s2"], error: null }))

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect([...result].sort()).toEqual(["s1", "s2"])
    expect(rpcCalls).toEqual([{ fn: "auth_direct_student_ids", args: { _node: MANAGER } }])
  })

  it("returns [] when the RPC resolves with no rows (case 2)", async () => {
    const { db } = makeRpcDb(async () => ({ data: [], error: null }))

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual([])
  })

  it("returns [] when the RPC resolves with null data (case 3)", async () => {
    const { db } = makeRpcDb(async () => ({ data: null, error: null }))

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual([])
  })

  it("fail-closed: returns [] when the RPC errors (case 4, e.g. gate rejects an out-of-subtree node)", async () => {
    const { db } = makeRpcDb(async () => ({ data: null, error: { message: "boom" } }))

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual([])
  })

  it("returns [] without calling the RPC when node is not a valid UUID (case 5)", async () => {
    const { db, rpcCalls } = makeRpcDb(async () => ({ data: ["s1"], error: null }))

    const result = await getDirectTeamStudentIds(db, TENANT, "not-a-uuid")

    expect(result).toEqual([])
    expect(rpcCalls).toHaveLength(0)
  })

  it("returns [] without calling the RPC when tenantId is empty (case 6)", async () => {
    const { db, rpcCalls } = makeRpcDb(async () => ({ data: ["s1"], error: null }))

    const result = await getDirectTeamStudentIds(db, "", MANAGER)

    expect(result).toEqual([])
    expect(rpcCalls).toHaveLength(0)
  })

  it("returns [] without calling the RPC when node is null/undefined (case 7)", async () => {
    const { db, rpcCalls } = makeRpcDb(async () => ({ data: ["s1"], error: null }))

    expect(await getDirectTeamStudentIds(db, TENANT, null)).toEqual([])
    expect(await getDirectTeamStudentIds(db, TENANT, undefined)).toEqual([])
    expect(rpcCalls).toHaveLength(0)
  })

  it("MULTI-CHAPÉU (Iteração 2/3, Caio bug): the RPC resolves the student hat via user_roles server-side, so a multi-hat id (e.g. primary role 'manager') is returned like any other (case 8)", async () => {
    const { db } = makeRpcDb(async () => ({ data: ["caio", "s1"], error: null }))

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect([...result].sort()).toEqual(["caio", "s1"])
  })
})
