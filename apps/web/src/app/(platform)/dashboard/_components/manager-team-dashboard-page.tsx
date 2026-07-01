// =============================================================================
// ManagerTeamDashboardPage — "Meu Time" dashboard (context = team)  [E9 engine]
// =============================================================================
//
// This is the DRILL-DOWN engine of E9, rendered by the dashboard router when the
// active context is `team` and the person holds the `manager` capability (see
// `resolveDashboardKind` => "manager-team").
//
// TWO VIEWS, one screen:
//   1. WHOLE-SUBTREE (default): no `focus` → the aggregate of EVERYTHING below
//      the manager (reports_to subtree ∪ descendant manager_group members,
//      UNION ALWAYS via E3). The breadcrumb shows a single "Meu Time" chip.
//   2. SUBTEAM (drill-down): `focus=<node>` → the analytics are re-resolved for
//      the subtree of that node. The breadcrumb gains a level ("Meu Time › Bia")
//      with links back up; the "Times abaixo" list shows the direct-report
//      managers under the focused node so the user can keep descending.
//
// The user alternates between the two by clicking:
//   • a SUBTEAM card in <SubtreeNodeList> → sets ?focus=<node>   ("descer")
//   • a BREADCRUMB segment in <OrgDrilldownBreadcrumb> → sets/clears ?focus ("subir")
//
// `focus` lives in the URL (shareable, SSR, re-validated server-side each render).
//
// SECURITY: nothing here widens reach. The focus is gated against
// `auth_subtree_user_ids()` (resolveDrilldownNav + getSubtreeStudentIdsAtNode);
// a forged node silently falls back to the manager's own root. All data flows
// through the RLS-scoped client, so a forged context/param yields, at worst, the
// caller's own subtree — never another's, never tenant-wide (AC6/AC7).
// A pure student never reaches this component: the router only routes
// `manager-team` for the `manager` capability.
// =============================================================================

import { TeamEngagementHeader } from "@/components/dashboard/team-engagement-header"
import { getTeamEngagementBuckets } from "@/lib/engagement-helpers"
import { resolveDrilldownNav } from "@/lib/org-tree"
import type { createClient } from "@/lib/supabase/server"
import { ManagerDashboardPage } from "./manager-dashboard-page"
import { OrgDrilldownBreadcrumb } from "./org-drilldown-breadcrumb"
import { SubtreeNodeList } from "./subtree-node-list"

interface ManagerTeamDashboardPageProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
  /** The authenticated manager's user id (= root of the team subtree to scope to). */
  managerId: string
  fullName: string
  /**
   * E9 drill-down target: a specific node inside the manager's subtree to focus.
   * `null`/undefined => the whole reachable team (default aggregate view). The
   * value comes from the URL (`?focus=`); it is gated server-side here and in the
   * analytics path before any reach resolution.
   */
  focusUserId?: string | null
}

export async function ManagerTeamDashboardPage({
  supabase,
  tenantId,
  managerId,
  fullName,
  focusUserId,
}: ManagerTeamDashboardPageProps) {
  // Resolve the navigation model: breadcrumb trail (root→focus) + the direct
  // subteams under the focus, both gated to auth_subtree_user_ids(). A forged /
  // out-of-scope focus falls back to the manager's own root (focusUserId below
  // is the RESOLVED, validated node — never the raw URL value blindly trusted).
  const nav = await resolveDrilldownNav(supabase, tenantId, managerId, focusUserId)

  // Is the manager currently looking at the whole subtree, or a subteam?
  const isRoot = nav.focusUserId === managerId
  const focusedLabel = isRoot ? "Meu Time" : nav.trail[nav.trail.length - 1]?.fullName || "Subtime"

  // Actionable engagement buckets over the SAME resolved scope the analytics use
  // (whole subtree when root, the gated subtree of the focused node otherwise).
  // Reuses the E9 scope primitives via getTeamEngagementBuckets — no widening.
  const engagementBuckets = await getTeamEngagementBuckets(
    supabase,
    tenantId,
    managerId,
    isRoot ? null : nav.focusUserId,
  )

  return (
    <div className="space-y-5">
      {/* Drill-down controls. Always rendered for a manager so the affordance is
          discoverable even at root (single-level breadcrumb). */}
      <section className="space-y-4 rounded-2xl bg-bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Recorte da equipe
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {isRoot
                ? "Você está vendo o agregado de toda a estrutura abaixo de você."
                : `Filtrado pelo time de ${focusedLabel}.`}
            </p>
          </div>
          {/* The breadcrumb IS the "voltar à árvore inteira": its root chip clears
              the focus. Each segment jumps to that level. */}
          <OrgDrilldownBreadcrumb trail={nav.trail} rootId={managerId} rootLabel="Meu Time" />
        </div>

        {/* "Times abaixo" — the descend affordance. Empty for a leaf manager. */}
        <SubtreeNodeList subteams={nav.subteams} />

        {/* Actionable engagement buckets over the resolved scope. Pure client
            modal state — clicking a card NEVER touches ?focus (E9 intact). */}
        <TeamEngagementHeader buckets={engagementBuckets} />
      </section>

      {/* The analytics, scoped to the resolved focus (whole subtree or subteam). */}
      <ManagerDashboardPage
        supabase={supabase}
        tenantId={tenantId}
        managerId={managerId}
        fullName={fullName}
        focusUserId={isRoot ? null : nav.focusUserId}
      />
    </div>
  )
}
