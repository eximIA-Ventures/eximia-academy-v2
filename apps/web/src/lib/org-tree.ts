// =============================================================================
// org-tree.ts — DRILL-DOWN navigation helpers (E9, EPIC-30)
// =============================================================================
//
// UI-facing read helpers that turn the manager's authorized subtree into the
// two navigation affordances of E9:
//   • the BREADCRUMB trail (root of the manager's subtree → focused node), and
//   • the "Times abaixo" list (direct-report MANAGERS under the focused node),
//     each with the aggregate count of its own subtree.
//
// SECURITY (the non-negotiable of E9): these helpers NEVER widen reach. Every
// label and every node they surface is constrained to the caller's own subtree
// via the E3 gate `auth_subtree_user_ids()` (the same gate behind
// `getSubtreeStudentIdsAtNode`). They run on the AUTHENTICATED RLS client, so:
//   1. the `users` rows they read are already filtered by `users_subtree_select`
//      (E4) — a name from outside the subtree is unreadable, not just hidden;
//   2. any focus node that is NOT in `auth_subtree_user_ids()` collapses to the
//      ROOT view (breadcrumb with one level, full-subtree node list). Forging a
//      `focus` param therefore reveals nothing — it just falls back to the
//      caller's own root, identical to the no-focus case (AC6/AC7).
//
// The drill-down does not change the mathematics or the permission — it only
// chooses the slice the screen shows. The RLS of E4 is the trava.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface OrgNode {
  id: string
  fullName: string
}

export interface SubteamNode extends OrgNode {
  /** Distinct students reachable under this node's subtree (UNION ALWAYS). */
  studentCount: number
}

export interface DrilldownNav {
  /**
   * Breadcrumb trail from the manager's own root down to the focused node.
   * Always starts with the manager (index 0). Length 1 = focused on root.
   * The LAST element is the currently focused node.
   */
  trail: OrgNode[]
  /** Direct-report managers under the focused node, with their subtree counts. */
  subteams: SubteamNode[]
  /** The resolved focus node id (root when focus was absent/forged/out-of-scope). */
  focusUserId: string
  /** True when the focus fell back to root because it was outside the subtree. */
  focusFellBack: boolean
}

/**
 * Resolves the drill-down navigation model for a manager.
 *
 * @param db        AUTHENTICATED RLS client of the manager (auth.uid() == managerId).
 * @param tenantId  the manager's tenant.
 * @param managerId the manager's own user id (root of their subtree).
 * @param focus     the requested focus node (from the URL); null = root.
 *
 * Order is fixed and gated: build the allowed set via `auth_subtree_user_ids()`,
 * validate `focus ∈` it (else fall back to root), THEN read labels/edges — all
 * intersected with the allowed set so nothing outside the subtree can leak.
 */
export async function resolveDrilldownNav(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS client, matches area-context.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  managerId: string,
  focus: string | null | undefined,
): Promise<DrilldownNav> {
  const root: OrgNode = { id: managerId, fullName: "" }
  const fallback: DrilldownNav = {
    trail: [root],
    subteams: [],
    focusUserId: managerId,
    focusFellBack: false,
  }
  if (!tenantId || !managerId) return fallback

  // GATE — the only nodes this caller may ever name or focus (E3, RLS-safe).
  const { data: subtreeUsersRaw } = await db.rpc("auth_subtree_user_ids")
  const allowed = new Set<string>((subtreeUsersRaw ?? []) as string[])
  // The manager is always part of their own subtree (E3 self-inclusion for nav).
  allowed.add(managerId)

  // Validate the requested focus against the gate. Forged / out-of-scope / bad
  // UUID → fall back to root (NEVER error, NEVER another subtree — AC6/AC7).
  let focusUserId = managerId
  let focusFellBack = false
  if (focus && UUID_RE.test(focus)) {
    if (allowed.has(focus)) {
      focusUserId = focus
    } else {
      focusFellBack = true // requested a node we can't see → silently root
    }
  }

  // Read labels + edges ONLY for nodes inside the gate. `users_subtree_select`
  // (E4) already filters, but intersecting with `allowed` is belt-and-braces.
  const allowedIds = [...allowed]
  const { data: userRows } = await db
    .from("users")
    .select("id, full_name, reports_to")
    .eq("tenant_id", tenantId)
    .in("id", allowedIds.length > 0 ? allowedIds : ["__none__"])

  const byId = new Map<string, { id: string; fullName: string; reportsTo: string | null }>()
  for (const r of userRows ?? []) {
    if (!allowed.has(r.id as string)) continue // never trust rows outside the gate
    byId.set(r.id as string, {
      id: r.id as string,
      fullName: (r.full_name as string) ?? "",
      reportsTo: (r.reports_to as string | null) ?? null,
    })
  }
  root.fullName = byId.get(managerId)?.fullName ?? ""

  // ---- Breadcrumb trail: walk reports_to up from focus to the manager root,
  // staying inside the gate. Cap depth defensively against malformed cycles.
  const trailReversed: OrgNode[] = []
  let cursor: string | null = focusUserId
  const guard = new Set<string>()
  for (let i = 0; cursor && i < 64; i++) {
    if (guard.has(cursor)) break // cycle guard
    guard.add(cursor)
    const node = byId.get(cursor)
    if (!node) break
    trailReversed.push({ id: node.id, fullName: node.fullName })
    if (cursor === managerId) break // reached the manager's own root
    cursor = node.reportsTo && allowed.has(node.reportsTo) ? node.reportsTo : null
  }
  // If the walk never reached the manager root (e.g. focus == root), ensure the
  // trail at least anchors on the root.
  let trail = trailReversed.reverse()
  if (trail.length === 0 || trail[0].id !== managerId) {
    trail = [{ id: managerId, fullName: root.fullName }, ...trail.filter((n) => n.id !== managerId)]
  }

  // ---- "Times abaixo": direct reports of the focused node that OWN A TEAM
  // (i.e. someone reports to them → there is somewhere to drill). A direct
  // report with no subordinates is a leaf and is NOT a drill target.
  const directReportIds = [...byId.values()]
    .filter((u) => u.reportsTo === focusUserId && u.id !== focusUserId)
    .map((u) => u.id)

  let subteams: SubteamNode[] = []
  if (directReportIds.length > 0) {
    // Which of those direct reports actually OWN A TEAM? Determine it from the
    // reports_to edges already in `byId` (all inside the gate / RLS-readable),
    // NOT from `user_roles`: a manager can only SELECT their OWN user_roles row
    // (policy `ur_self_select`, E1), so querying a subordinate's `manager` hat
    // returns zero rows and the whole "Times abaixo" list would collapse to
    // empty (the drill-down would never appear). "Owns a team" = "someone in the
    // subtree reports to this node", which is exactly the drill predicate and is
    // fully readable here under `users_subtree_select` (E4).
    const ownsTeam = new Set<string>()
    for (const u of byId.values()) {
      if (u.reportsTo && allowed.has(u.reportsTo)) ownsTeam.add(u.reportsTo)
    }

    // Each subteam's aggregate count = students reachable under that node. The
    // node is in `allowed` (it is a direct report inside the gate), so the gate
    // for `subtree_student_ids` is already satisfied; we still resolve via the
    // E3 RPC so the math is identical to the analytics path (UNION ALWAYS).
    const candidates = directReportIds
      .map((id) => byId.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u && ownsTeam.has(u.id))
    subteams = await Promise.all(
      candidates.map(async (node) => {
        const { data: studentIds } = await db.rpc("subtree_student_ids", { _node: node.id })
        const count = new Set((studentIds ?? []) as string[]).size
        return { id: node.id, fullName: node.fullName, studentCount: count }
      }),
    )
    subteams.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }

  return { trail, subteams, focusUserId, focusFellBack }
}
