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

// Rafael's subtree (9 ids: himself + Bia + Caco + 6 leaves), as auth_subtree_user_ids().
const RAFAEL_SUBTREE = [RAFAEL, BIA, CACO, CAIO, DUDA, FABI]

interface UserRow {
  id: string
  full_name: string
  reports_to: string | null
}

const USERS: UserRow[] = [
  { id: RAFAEL, full_name: "Rafael Norte", reports_to: "5a4d0000-0000-0000-0000-0000000000a0" },
  { id: BIA, full_name: "Bia Time-A", reports_to: RAFAEL },
  { id: CACO, full_name: "Caco Time-B", reports_to: RAFAEL },
  { id: CAIO, full_name: "Caio", reports_to: BIA },
  { id: DUDA, full_name: "Duda", reports_to: BIA },
  { id: FABI, full_name: "Fabi", reports_to: CACO },
]

/**
 * Minimal RLS-shaped Supabase double. Critically, the `user_roles` select
 * resolves to `[]` — exactly what RLS returns for a manager reading a
 * subordinate's hat — to prove the fix does NOT depend on that query.
 */
function makeClient(opts: { subtree: string[]; users: UserRow[] }) {
  return {
    rpc: async (name: string, args?: { _node?: string }) => {
      if (name === "auth_subtree_user_ids") return { data: opts.subtree }
      if (name === "subtree_student_ids") {
        // students under the requested node (leaves whose chain reaches _node)
        const node = args?._node
        const childrenOf = (id: string) => opts.users.filter((u) => u.reports_to === id)
        const collect = (id: string): string[] => {
          const kids = childrenOf(id)
          if (kids.length === 0) return [id]
          return kids.flatMap((k) => collect(k.id))
        }
        return { data: node ? collect(node) : [] }
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
