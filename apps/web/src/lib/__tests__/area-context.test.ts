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

describe("getDirectTeamStudentIds", () => {
  it("unions direct reports_to students with owned manager_group members (case 1)", async () => {
    const { db, fromCalls, eqCalls, inCalls } = makeDb({
      users: [{ id: "s1" }, { id: "s2" }],
      user_roles: [{ user_id: "s1" }, { user_id: "s2" }],
      manager_groups: [{ id: "g1" }],
      manager_group_members: [{ student_id: "s2" }, { student_id: "s3" }],
    })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect([...result].sort()).toEqual(["s1", "s2", "s3"])

    // (a) direct report CANDIDATES: users filtered by tenant + reports_to (NOT
    // by the singular role column anymore — see multi-hat fix below).
    expect(eqCalls).toContainEqual({ table: "users", col: "tenant_id", val: TENANT })
    expect(eqCalls).toContainEqual({ table: "users", col: "reports_to", val: MANAGER })
    expect(eqCalls).not.toContainEqual({ table: "users", col: "role", val: "student" })

    // (a2) STUDENT HAT filter now happens against `user_roles` (E7), not `users`.
    expect(eqCalls).toContainEqual({ table: "user_roles", col: "role", val: "student" })
    expect(inCalls).toContainEqual({
      table: "user_roles",
      col: "user_id",
      vals: ["s1", "s2"],
    })

    // (b) owned groups + explicit members — same shape as getManagedTeamStudentIds.
    expect(eqCalls).toContainEqual({ table: "manager_groups", col: "manager_id", val: MANAGER })
    expect(inCalls).toContainEqual({
      table: "manager_group_members",
      col: "group_id",
      vals: ["g1"],
    })

    // No corporate fan-out and no subtree RPC — direct-only never widens.
    expect(fromCalls).not.toContain("manager_group_units")
  })

  it("returns direct reports_to students even when the manager owns no group (case 2)", async () => {
    const { db, fromCalls } = makeDb({
      users: [{ id: "s1" }],
      user_roles: [{ user_id: "s1" }],
      manager_groups: [],
    })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual(["s1"])
    // Owns no group → member query never issued (mirrors getManagedTeamStudentIds case 3).
    expect(fromCalls).not.toContain("manager_group_members")
  })

  it("returns [] when the node has neither direct reports nor a group (case 3)", async () => {
    const { db } = makeDb({ users: [], manager_groups: [] })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual([])
  })

  it("de-dupes a student that is both a direct report and an explicit group member (case 4)", async () => {
    const { db } = makeDb({
      users: [{ id: "s1" }],
      user_roles: [{ user_id: "s1" }],
      manager_groups: [{ id: "g1" }],
      manager_group_members: [{ student_id: "s1" }],
    })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual(["s1"])
  })

  it("returns [] without querying when node is not a valid UUID (case 5)", async () => {
    const { db, fromCalls } = makeDb({ users: [{ id: "s1" }] })

    const result = await getDirectTeamStudentIds(db, TENANT, "not-a-uuid")

    expect(result).toEqual([])
    expect(fromCalls).toHaveLength(0)
  })

  it("returns [] without querying when tenantId is empty (case 6)", async () => {
    const { db, fromCalls } = makeDb({ users: [{ id: "s1" }] })

    const result = await getDirectTeamStudentIds(db, "", MANAGER)

    expect(result).toEqual([])
    expect(fromCalls).toHaveLength(0)
  })

  it("returns [] without querying when node is null/undefined (case 7)", async () => {
    const { db, fromCalls } = makeDb({ users: [{ id: "s1" }] })

    expect(await getDirectTeamStudentIds(db, TENANT, null)).toEqual([])
    expect(await getDirectTeamStudentIds(db, TENANT, undefined)).toEqual([])
    expect(fromCalls).toHaveLength(0)
  })

  it("MULTI-CHAPÉU (Iteração 2, Caio bug): includes a direct report whose PRIMARY users.role is 'manager' but who ALSO holds the student hat via user_roles (case 8)", async () => {
    const { db } = makeDb({
      // Caio: primary role 'manager' in `users`, but the candidate resolution
      // no longer reads `users.role` at all — only `reports_to`. His STUDENT
      // hat lives in `user_roles`, which IS what gates inclusion below.
      users: [{ id: "caio" }, { id: "s1" }],
      user_roles: [{ user_id: "caio" }, { user_id: "s1" }], // both hold role=student
      manager_groups: [],
    })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect([...result].sort()).toEqual(["caio", "s1"])
  })

  it("MULTI-CHAPÉU: excludes a direct report candidate who does NOT hold the student hat (case 9)", async () => {
    const { db } = makeDb({
      users: [{ id: "pure-manager" }, { id: "s1" }],
      // Only s1 holds the student hat — pure-manager is a direct report by
      // reports_to but never appears in user_roles(role='student').
      user_roles: [{ user_id: "s1" }],
      manager_groups: [],
    })

    const result = await getDirectTeamStudentIds(db, TENANT, MANAGER)

    expect(result).toEqual(["s1"])
  })
})
