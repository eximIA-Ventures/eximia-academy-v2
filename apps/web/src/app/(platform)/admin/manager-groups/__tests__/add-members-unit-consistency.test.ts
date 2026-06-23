import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Story 8 — Membro do time pertence a unidade.
 *
 * Tests the app-layer consistency guard added to `addManagerGroupMembers`:
 * a student can only be added to a team if they belong (via user_areas) to at
 * least one UNIDADE linked to the team (manager_group_units). When the team has
 * NO unit, the guard permits the add (unit-less group). No RLS / DB involved —
 * the guard is pure application code over `dbFor(ctx)`.
 *
 * Mock strategy: a table-keyed, chainable, awaitable Supabase stub. The auth
 * context (`getAuthContext`) reads `users` via `.single()` (profile row), while
 * the action reads `users` via `.in()` (student validation). The stub serves a
 * dedicated `.single()` result for the profile and the array result otherwise.
 */

/* --------- mocks --------- */

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}))

// Service client must never be needed here (profile has a tenant_id), but mock
// it so an accidental call is observable rather than crashing the import.
const mockServiceFrom = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: (table: string) => mockServiceFrom(table) })),
}))

const mockResolveTenantId = vi.fn()
vi.mock("@/lib/auth", () => ({
  resolveTenantId: (...args: unknown[]) => mockResolveTenantId(...args),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { addManagerGroupMembers } from "../actions"

/* --------- helpers --------- */

const TENANT = "tenant-1"
const ADMIN = "admin-1"
const GROUP = "group-1"
const U1 = "unit-1"
const U2 = "unit-2"

type Row = Record<string, unknown>

interface TableData {
  // users via .in() → student validation rows
  users?: Row[]
  // users via .single() → caller profile (role/tenant_id)
  usersProfile?: Row
  manager_groups?: Row // single() result
  manager_group_members?: Row[] // existing members (via .in)
  manager_group_units?: Row[]
  user_areas?: Row[]
}

interface RecordedInsert {
  table: string
  payload: unknown
}

/**
 * Builds the chainable stub and records inserts so tests can assert that the
 * guard blocked (zero inserts into manager_group_members) or allowed the add.
 */
function makeDb(data: TableData) {
  const inserts: RecordedInsert[] = []

  type Builder = Promise<{ data: unknown; error: null }> & {
    select: () => Builder
    eq: (col: string, val: unknown) => Builder
    in: (col: string, vals: unknown[]) => Builder
    single: () => Promise<{ data: unknown; error: null }>
    insert: (payload: unknown) => Promise<{ data: null; error: null }>
  }

  const from = vi.fn((table: string): Builder => {
    // Default awaitable payload per table (array-returning queries).
    let arrayData: Row[] = []
    if (table === "users") arrayData = data.users ?? []
    else if (table === "manager_group_members") arrayData = data.manager_group_members ?? []
    else if (table === "manager_group_units") arrayData = data.manager_group_units ?? []
    else if (table === "user_areas") arrayData = data.user_areas ?? []

    const builder: Builder = Object.assign(Promise.resolve({ data: arrayData, error: null }), {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      single: vi.fn(() => {
        if (table === "users")
          return Promise.resolve({ data: data.usersProfile ?? null, error: null })
        if (table === "manager_groups")
          return Promise.resolve({ data: data.manager_groups ?? null, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload })
        return Promise.resolve({ data: null, error: null })
      }),
    })
    return builder
  })

  mockFrom.mockImplementation(from)
  return { inserts }
}

/** Wires the happy-path auth: admin caller with a real tenant. */
function authAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN } } })
  mockResolveTenantId.mockResolvedValue(TENANT)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockServiceFrom.mockImplementation(() => {
    throw new Error("service client should not be used in these tests")
  })
})

/* --------- tests --------- */

describe("addManagerGroupMembers — unit consistency guard (Story 8)", () => {
  it("case 1: student belongs to the team's unit → adds", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [{ user_id: "s1", area_id: U1 }],
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect(res).toEqual({ success: true, added: 1 })
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(1)
  })

  it("case 1b: corporate team (N units) → student in any one unit passes", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }, { unit_id: U2 }],
      user_areas: [{ user_id: "s1", area_id: U2 }],
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect(res).toEqual({ success: true, added: 1 })
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(1)
  })

  it("case 2: student belongs to NO unit of the team → blocks, no insert", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [{ user_id: "s1", area_id: U2 }],
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect("error" in res && res.error).toContain("não pertence a unidade deste time")
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(0)
  })

  it("case 3: student with no areas at all → blocks", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [], // student has zero units
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect("error" in res && res.error).toContain("não pertence a unidade deste time")
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(0)
  })

  it("case 4: team with NO unit linked → permits (unit-less)", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [],
      manager_group_units: [], // no unit → nothing to validate against
      user_areas: [{ user_id: "s1", area_id: U2 }],
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect(res).toEqual({ success: true, added: 1 })
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(1)
  })

  it("case 5: mix valid + invalid → blocks all, zero inserts, names offender", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [
        { id: "s1", full_name: "Aluno Um", email: "s1@x.com" },
        { id: "s2", full_name: "Maria Silva", email: "s2@x.com" },
      ],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [
        { user_id: "s1", area_id: U1 }, // valid
        { user_id: "s2", area_id: U2 }, // offender
      ],
    })

    const res = await addManagerGroupMembers(GROUP, ["s1", "s2"])

    expect("error" in res && res.error).toBe("Aluno Maria Silva não pertence a unidade deste time")
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(0)
  })

  it("case 6: offender already a member → guard runs only over toAdd, new one passes", async () => {
    authAdmin()
    // s_old is already a member (would be an offender if it counted), but it's
    // filtered out by idempotency; only s1 (valid) is in toAdd.
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [
        { id: "s1", full_name: "Aluno Um", email: "s1@x.com" },
        { id: "s_old", full_name: "Velho", email: "old@x.com" },
      ],
      manager_group_members: [{ student_id: "s_old" }],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [{ user_id: "s1", area_id: U1 }], // s_old has no matching area
    })

    const res = await addManagerGroupMembers(GROUP, ["s1", "s_old"])

    expect(res).toEqual({ success: true, added: 1 })
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(1)
  })

  it("case 7: toAdd empty (all already members) → success added:0, no guard run", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [{ id: "s1", full_name: "Aluno Um", email: "s1@x.com" }],
      manager_group_members: [{ student_id: "s1" }], // already a member
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [{ user_id: "s1", area_id: U2 }], // would be offender if guard ran
    })

    const res = await addManagerGroupMembers(GROUP, ["s1"])

    expect(res).toEqual({ success: true, added: 0 })
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(0)
  })

  it("case 8: offender named by email when full_name is null, '(e mais N)' suffix", async () => {
    authAdmin()
    const { inserts } = makeDb({
      usersProfile: { role: "admin", tenant_id: TENANT },
      manager_groups: { id: GROUP, tenant_id: TENANT, manager_id: null },
      users: [
        { id: "s1", full_name: null, email: "noname@x.com" },
        { id: "s2", full_name: "Outro", email: "s2@x.com" },
      ],
      manager_group_members: [],
      manager_group_units: [{ unit_id: U1 }],
      user_areas: [], // both offenders
    })

    const res = await addManagerGroupMembers(GROUP, ["s1", "s2"])

    expect("error" in res && res.error).toBe(
      "Aluno noname@x.com não pertence a unidade deste time (e mais 1)",
    )
    expect(inserts.filter((i) => i.table === "manager_group_members")).toHaveLength(0)
  })
})
