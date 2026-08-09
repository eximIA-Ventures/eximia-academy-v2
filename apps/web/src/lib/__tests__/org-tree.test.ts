import { describe, expect, it } from "vitest"
import { resolveDrilldownNav } from "../org-tree"

// =============================================================================
// resolveDrilldownNav — "Times abaixo" must list a manager's subteams.
// =============================================================================
//
// Regression guard for the SECOND root cause of "Rafael não vê a parte de time":
// the subteam predicate used to query `user_roles` for the subordinates' `manager`
// hat, but RLS policy `ur_self_select` (E1) only lets a user read their OWN
// user_roles row. So that query returns [] for Bia/Caco and the drill-down list
// collapsed to empty. The fix derives "owns a team" from reports_to edges (which
// the manager CAN read via users_subtree_select, E4). These tests assert the list
// is populated even when the `user_roles` query returns nothing.
// =============================================================================

const TENANT = "5a4d0000-0000-0000-0000-000000000001"
const RAFAEL = "5a4d0000-0000-0000-0000-0000000000b1"
const BIA = "5a4d0000-0000-0000-0000-0000000000c1"
const CACO = "5a4d0000-0000-0000-0000-0000000000c2"
const CAIO = "5a4d0000-0000-0000-0000-0000000000d1" // reports to Bia
const DUDA = "5a4d0000-0000-0000-0000-0000000000d2" // reports to Bia
const FABI = "5a4d0000-0000-0000-0000-0000000000d4" // reports to Caco
const GIL = "5a4d0000-0000-0000-0000-0000000000c3" // direct child, owns a manager group
const HANA = "5a4d0000-0000-0000-0000-0000000000e1" // member of Gil's group
const IGOR = "5a4d0000-0000-0000-0000-0000000000e2" // member of Gil's group
const GIL_GROUP = "5a4d0000-0000-0000-0000-00000000f001"
const CAIO_GROUP = "5a4d0000-0000-0000-0000-00000000f002"

// Rafael's subtree, as auth_subtree_user_ids().
const RAFAEL_SUBTREE = [RAFAEL, BIA, CACO, CAIO, DUDA, FABI]

interface UserRow {
  id: string
  full_name: string
  reports_to: string | null
}

interface ManagerGroupRow {
  id: string
  manager_id: string
  tenant_id: string
}

interface ManagerGroupMemberRow {
  group_id: string
  student_id: string
  tenant_id: string
}

const USERS: UserRow[] = [
  { id: RAFAEL, full_name: "Rafael Norte", reports_to: "5a4d0000-0000-0000-0000-0000000000a0" },
  { id: BIA, full_name: "Bia Time-A", reports_to: RAFAEL },
  { id: CACO, full_name: "Caco Time-B", reports_to: RAFAEL },
  { id: CAIO, full_name: "Caio", reports_to: BIA },
  { id: DUDA, full_name: "Duda", reports_to: BIA },
  { id: FABI, full_name: "Fabi", reports_to: CACO },
]

const GROUP_USERS: UserRow[] = [
  ...USERS,
  { id: GIL, full_name: "Gil Time-C", reports_to: RAFAEL },
  { id: HANA, full_name: "Hana", reports_to: null },
  { id: IGOR, full_name: "Igor", reports_to: null },
]

const MANAGER_GROUPS: ManagerGroupRow[] = [{ id: GIL_GROUP, manager_id: GIL, tenant_id: TENANT }]

const MANAGER_GROUP_MEMBERS: ManagerGroupMemberRow[] = [
  { group_id: GIL_GROUP, student_id: HANA, tenant_id: TENANT },
  { group_id: GIL_GROUP, student_id: IGOR, tenant_id: TENANT },
]

/**
 * Minimal RLS-shaped Supabase double. Critically, the `user_roles` select
 * resolves to `[]` — exactly what RLS returns for a manager reading a
 * subordinate's hat — to prove the fix does NOT depend on that query.
 */
function makeClient(opts: {
  subtree: string[]
  users: UserRow[]
  managerGroups?: ManagerGroupRow[]
  managerGroupMembers?: ManagerGroupMemberRow[]
}) {
  return {
    rpc: async (name: string, args?: { _node?: string }) => {
      if (name === "auth_subtree_user_ids") return { data: opts.subtree }
      if (name === "subtree_student_ids") {
        // students under the requested node (leaves whose chain reaches _node)
        const node = args?._node
        const childrenOf = (id: string) => opts.users.filter((u) => u.reports_to === id)
        const collect = (id: string): string[] => {
          const kids = childrenOf(id)
          const groups = (opts.managerGroups ?? []).filter((group) => group.manager_id === id)
          const groupMemberIds = (opts.managerGroupMembers ?? [])
            .filter((member) => groups.some((group) => group.id === member.group_id))
            .map((member) => member.student_id)
          if (kids.length === 0 && groupMemberIds.length === 0) return [id]
          return [...kids.flatMap((k) => collect(k.id)), ...groupMemberIds]
        }
        const rootGroupMemberIds =
          node === RAFAEL
            ? (opts.managerGroupMembers ?? [])
                .filter((member) =>
                  (opts.managerGroups ?? []).some(
                    (group) =>
                      group.id === member.group_id && opts.subtree.includes(group.manager_id),
                  ),
                )
                .map((member) => member.student_id)
            : []
        return { data: node ? [...new Set([...collect(node), ...rootGroupMemberIds])] : [] }
      }
      return { data: [] }
    },
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) =>
                Promise.resolve({ data: opts.users.filter((u) => ids.includes(u.id)) }),
            }),
          }),
        }
      }
      if (table === "user_roles") {
        // RLS: a manager can only read their OWN row → subordinate hats = [].
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: [] as unknown[] }),
            }),
          }),
        }
      }
      if (table === "manager_groups") {
        return {
          select: () => ({
            eq: (_col: string, tenantId: string) => ({
              in: (_col: string, managerIds: string[]) =>
                Promise.resolve({
                  data: (opts.managerGroups ?? []).filter(
                    (group) =>
                      group.tenant_id === tenantId && managerIds.includes(group.manager_id),
                  ),
                }),
            }),
          }),
        }
      }
      if (table === "manager_group_members") {
        return {
          select: () => ({
            eq: (_col: string, tenantId: string) => ({
              in: (_col: string, groupIds: string[]) =>
                Promise.resolve({
                  data: (opts.managerGroupMembers ?? []).filter(
                    (member) => member.tenant_id === tenantId && groupIds.includes(member.group_id),
                  ),
                }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
    // biome-ignore lint/suspicious/noExplicitAny: test double for the loosely-typed RLS client
  } as any
}

describe("resolveDrilldownNav — Times abaixo (RLS-safe subteam predicate)", () => {
  it("lists Bia and Caco as subteams for Rafael, even when user_roles returns []", async () => {
    const db = makeClient({ subtree: RAFAEL_SUBTREE, users: USERS })
    const nav = await resolveDrilldownNav(db, TENANT, RAFAEL, null)

    expect(nav.focusUserId).toBe(RAFAEL)
    const names = nav.subteams.map((s) => s.fullName).sort()
    expect(names).toEqual(["Bia Time-A", "Caco Time-B"])
    // each owns a team of students under them
    const byName = Object.fromEntries(nav.subteams.map((s) => [s.fullName, s.studentCount]))
    expect(byName["Bia Time-A"]).toBe(2) // Caio + Duda
    expect(byName["Caco Time-B"]).toBe(1) // Fabi
  })

  it("lists a direct child manager-group owner without subordinate reports_to edges", async () => {
    const db = makeClient({
      subtree: [...RAFAEL_SUBTREE, GIL, HANA, IGOR],
      users: GROUP_USERS,
      managerGroups: MANAGER_GROUPS,
      managerGroupMembers: MANAGER_GROUP_MEMBERS,
    })
    const nav = await resolveDrilldownNav(db, TENANT, RAFAEL, null)

    const names = nav.subteams.map((s) => s.fullName).sort()
    expect(names).toEqual(["Bia Time-A", "Caco Time-B", "Gil Time-C"])
    const gil = nav.subteams.find((s) => s.id === GIL)
    expect(gil?.studentCount).toBe(2)
  })

  it("does not list a grandchild manager-group owner under the root", async () => {
    const db = makeClient({
      subtree: [...RAFAEL_SUBTREE, HANA],
      users: [...USERS, { id: HANA, full_name: "Hana", reports_to: null }],
      managerGroups: [{ id: CAIO_GROUP, manager_id: CAIO, tenant_id: TENANT }],
      managerGroupMembers: [{ group_id: CAIO_GROUP, student_id: HANA, tenant_id: TENANT }],
    })

    const rootNav = await resolveDrilldownNav(db, TENANT, RAFAEL, null)
    expect(rootNav.subteams.map((s) => s.fullName).sort()).toEqual([
      "Bia Time-A",
      "Caco Time-B",
    ])

    const biaNav = await resolveDrilldownNav(db, TENANT, RAFAEL, BIA)
    expect(biaNav.subteams.map((s) => s.fullName)).toEqual(["Caio"])
  })

  it("hides manager-group owners when manager_groups is not readable", async () => {
    const db = makeClient({
      subtree: [...RAFAEL_SUBTREE, GIL, HANA, IGOR],
      users: GROUP_USERS,
      managerGroups: [],
      managerGroupMembers: MANAGER_GROUP_MEMBERS,
    })
    const nav = await resolveDrilldownNav(db, TENANT, RAFAEL, null)

    const names = nav.subteams.map((s) => s.fullName).sort()
    expect(names).toEqual(["Bia Time-A", "Caco Time-B"])
  })

  it("does not list a root manager-group owner under an unrelated focused subteam", async () => {
    const db = makeClient({
      subtree: [...RAFAEL_SUBTREE, GIL, HANA, IGOR],
      users: GROUP_USERS,
      managerGroups: MANAGER_GROUPS,
      managerGroupMembers: MANAGER_GROUP_MEMBERS,
    })
    const nav = await resolveDrilldownNav(db, TENANT, RAFAEL, BIA)

    expect(nav.focusUserId).toBe(BIA)
    expect(nav.subteams.map((s) => s.fullName)).not.toContain("Gil Time-C")
  })

  it("a leaf manager (Bia) sees no subteams (nothing to drill into)", async () => {
    // Bia's subtree = Bia + Caio + Duda; none of her direct reports own a team.
    const biaSubtree = [BIA, CAIO, DUDA]
    const biaUsers = USERS.filter((u) => biaSubtree.includes(u.id))
    const db = makeClient({ subtree: biaSubtree, users: biaUsers })
    const nav = await resolveDrilldownNav(db, TENANT, BIA, null)
    expect(nav.subteams).toEqual([])
  })

  it("breadcrumb anchors on the manager root", async () => {
    const db = makeClient({ subtree: RAFAEL_SUBTREE, users: USERS })
    const nav = await resolveDrilldownNav(db, TENANT, RAFAEL, null)
    expect(nav.trail[0].id).toBe(RAFAEL)
    expect(nav.trail[0].fullName).toBe("Rafael Norte")
  })
})
