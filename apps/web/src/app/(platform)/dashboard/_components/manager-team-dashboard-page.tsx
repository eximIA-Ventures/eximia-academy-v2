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
//
// ORDEM VISUAL (Iteração 2, 2026-07-02): "meu time primeiro, depois o que está
// abaixo dele". In Hierarquia mode, "Times abaixo" is the PRIMARY content (it
// IS the structure below), rendered BEFORE the strip.
//
// DIRETOS MODE (Iteração 3, 2026-07-02): "Times abaixo" is NO LONGER rendered
// in Diretos mode — it belongs exclusively to Hierarquia, where drilling into
// subtrees is the point. Diretos is about the manager's own direct people; a
// list of subteams there was a stray drill door that didn't match the mode's
// purpose (product feedback, supersedes the old AC-5 "both modes" rule). The
// breadcrumb (drill trail) still renders in both modes — a manager who drilled
// down via Hierarquia and then flips to Diretos keeps their place in the tree.
// =============================================================================

import { TeamEngagementHeader } from "@/components/dashboard/team-engagement-header"
import { getSubtreeStudentIdsAtNode } from "@/lib/area-context"
import type { EngagementSummary } from "@/lib/engagement-helpers"
import { getSubteamEngagementSummaries, getTeamEngagementBuckets } from "@/lib/engagement-helpers"
import { resolveDrilldownNav } from "@/lib/org-tree"
import type { createClient } from "@/lib/supabase/server"
import { getTeamViewMode } from "@/lib/team-view-context"
import { ManagerDashboardPage } from "./manager-dashboard-page"
import { OrgDrilldownBreadcrumb } from "./org-drilldown-breadcrumb"
import { SubtreeNodeList } from "./subtree-node-list"
import { TeamViewSwitch } from "./team-view-switch"

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

  // Diretos / Hierarquia switch: applies to the FOCUSED node (root or a
  // drilled-down subteam). "direct" (default) = only the node's direct
  // students; "hierarchy" = the node's whole reachable subtree (previous
  // "global" behaviour, renamed). This never changes `focus` — only the
  // direct-vs-subtree slice of the already-resolved node.
  const teamViewMode = await getTeamViewMode()

  // Actionable engagement buckets over the SAME resolved scope the analytics use
  // (whole subtree when root, the gated subtree of the focused node otherwise),
  // now filtered by the Diretos/Hierarquia switch. Reuses the E9 scope
  // primitives via getTeamEngagementBuckets — no widening.
  const engagementBuckets = await getTeamEngagementBuckets(
    supabase,
    tenantId,
    managerId,
    isRoot ? null : nav.focusUserId,
    teamViewMode,
  )

  // Mini engagement indicators per "Times abaixo" card (Hierarquia mode only —
  // Diretos mode has no subordinate structure to summarize per-card, only the
  // single flat strip above). One batched pass over the UNION of every
  // subteam's subtree — see getSubteamEngagementSummaries for why this is not
  // N separate getTeamEngagementBuckets calls.
  let subteamEngagement: Map<string, EngagementSummary> | undefined
  if (teamViewMode === "hierarchy" && nav.subteams.length > 0) {
    const subteamStudentSets = await Promise.all(
      nav.subteams.map(async (team) => ({
        nodeId: team.id,
        studentIds: await getSubtreeStudentIdsAtNode(supabase, tenantId, team.id),
      })),
    )
    subteamEngagement = await getSubteamEngagementSummaries(supabase, tenantId, subteamStudentSets)
  }

  // Drill-down controls. Always rendered for a manager so the affordance is
  // discoverable even at root (single-level breadcrumb). Passed as a slot to
  // <ManagerDashboardPage> (which forwards it to <ManagerDashboard>) so the
  // "Olá, {nome}" hero stays the FIRST visual element of the page, even in
  // the "Meu Time" context — mirrors how teachingPlanHighlights is wired.
  //
  // ORDEM VISUAL: "Hierarquia" mode shows "Times abaixo" (with mini
  // engagement indicators) as the primary content, the strip below it
  // aggregates the whole subtree. "Diretos" mode (Iteração 3) shows ONLY the
  // engagement strip — no "Times abaixo" at this level (see file header).
  const subtreeList = (
    <SubtreeNodeList subteams={nav.subteams} engagementByNodeId={subteamEngagement} />
  )
  const engagementStrip = <TeamEngagementHeader buckets={engagementBuckets} />

  const teamRecortePanel = (
    <section className="space-y-4 rounded-2xl bg-bg-card p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Recorte da equipe
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {teamViewMode === "hierarchy"
              ? isRoot
                ? "Você está vendo o agregado de toda a estrutura abaixo de você."
                : `Filtrado pela estrutura inteira abaixo de ${focusedLabel}.`
              : isRoot
                ? "Você está vendo seus colaboradores diretos."
                : `Filtrado pelos membros diretos de ${focusedLabel}.`}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {/* The breadcrumb IS the "voltar à árvore inteira": its root chip
              clears the focus. Each segment jumps to that level. */}
          <OrgDrilldownBreadcrumb trail={nav.trail} rootId={managerId} rootLabel="Meu Time" />
          {/* Diretos / Hierarquia — applies to the currently focused node. */}
          <TeamViewSwitch mode={teamViewMode} />
        </div>
      </div>

      {teamViewMode === "hierarchy" ? (
        <>
          {/* Hierarquia: "Times abaixo" (with mini engagement per subtime) IS
              the primary content at this level. */}
          {subtreeList}
          {engagementStrip}
        </>
      ) : (
        // Diretos (Iteração 3): only the engagement strip over MY direct
        // people — "Times abaixo" is Hierarquia-exclusive (see file header).
        engagementStrip
      )}
    </section>
  )

  // The analytics, scoped to the resolved focus (whole subtree or subteam)
  // AND the Diretos/Hierarquia switch. The hero ("Olá, {nome}") renders first
  // inside <ManagerDashboard>; teamRecortePanel is a slot rendered right
  // after it.
  return (
    <ManagerDashboardPage
      supabase={supabase}
      tenantId={tenantId}
      managerId={managerId}
      fullName={fullName}
      focusUserId={isRoot ? null : nav.focusUserId}
      teamViewMode={teamViewMode}
      teamRecortePanel={teamRecortePanel}
    />
  )
}
