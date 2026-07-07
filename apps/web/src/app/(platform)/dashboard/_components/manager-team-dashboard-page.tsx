// =============================================================================
// ManagerTeamDashboardPage, "Meu Time" dashboard (context = team)  [E9 engine]
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
//      with links back up.
//
// The user alternates between the two by clicking:
//   • a BREADCRUMB segment in <OrgDrilldownBreadcrumb> → sets/clears ?focus ("subir")
//
// `focus` lives in the URL (shareable, SSR, re-validated server-side each render).
//
// SECURITY: nothing here widens reach. The focus is gated against
// `auth_subtree_user_ids()` (resolveDrilldownNav);
// a forged node silently falls back to the manager's own root. All data flows
// through the RLS-scoped client, so a forged context/param yields, at worst, the
// caller's own subtree, never another's, never tenant-wide (AC6/AC7).
// A pure student never reaches this component: the router only routes
// `manager-team` for the `manager` capability.
//
// ORDEM VISUAL (Iteração 6, 2026-07-03): the top recorte panel always shows
// the manager's direct students in the engagement strip. Diretos/Hierarquia is
// still passed down to the student table, but it no longer changes this top
// strip. The breadcrumb (drill trail) still renders in both modes, a manager
// who drilled down keeps their place in the tree.
// =============================================================================

import { getStudentSubteamMap } from "@/lib/area-context"
import { getTeamEngagementBuckets } from "@/lib/engagement-helpers"
import { resolveDrilldownNav } from "@/lib/org-tree"
import type { createClient } from "@/lib/supabase/server"
import { getTeamViewMode } from "@/lib/team-view-context"
import { ManagerDashboardPage } from "./manager-dashboard-page"
import { DIRECT_TEAM_KEY, type TeamFilterOption } from "./team-filter-dropdown"
import { TeamMemberList } from "./team-member-list"
import { TeamScopeControl } from "./team-scope-control"

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
  // is the RESOLVED, validated node, never the raw URL value blindly trusted).
  const nav = await resolveDrilldownNav(supabase, tenantId, managerId, focusUserId)

  // Is the manager currently looking at the whole subtree, or a subteam?
  const isRoot = nav.focusUserId === managerId
  const focusedLabel = isRoot ? "Meu Time" : nav.trail[nav.trail.length - 1]?.fullName || "Subtime"

  // Diretos / Hierarquia switch: applies to the FOCUSED node (root or a
  // drilled-down subteam). "direct" (default) = only the node's direct
  // students; "hierarchy" = the node's whole reachable subtree (previous
  // "global" behaviour, renamed). This never changes `focus`, only the
  // direct-vs-subtree slice of the already-resolved node.
  const teamViewMode = await getTeamViewMode()

  // Actionable engagement buckets for the top recorte strip. Product decided
  // this strip is always direct-only; the Diretos/Hierarquia switch is still
  // passed to <ManagerDashboardPage> for the student table below.
  const engagementBuckets = await getTeamEngagementBuckets(
    supabase,
    tenantId,
    managerId,
    isRoot ? null : nav.focusUserId,
    "direct",
  )

  // Drill-down controls. Always rendered for a manager so the affordance is
  // discoverable even at root (single-level breadcrumb). Passed as a slot to
  // <ManagerDashboardPage> (which forwards it to <ManagerDashboard>) so the
  // "Olá, {nome}" hero stays the FIRST visual element of the page, even in
  // the "Meu Time" context, mirrors how teachingPlanHighlights is wired.
  const teamMemberSubteamCounts = new Map(
    nav.subteams.map((subteam) => [subteam.id, subteam.studentCount] as const),
  )

  // S6 (Onda 2): opções do filtro de time elevado ao recorte. Mitigação (b) do
  // Risco 3 da spec S6 (decisão registrada em spec-001, NÃO usar nav.subteams
  // aqui): `nav.subteams` inclui nós group-owner-only que `getStudentSubteamMap`
  // nunca atribui a nenhuma row (universos divergentes), o que criaria opções
  // mortas no dropdown (seleção que nunca filtra nada). Deriva-se em vez disso
  // do MESMO universo das rows — `getStudentSubteamMap`, a mesma chamada que
  // `manager-dashboard-page.tsx` usa para preencher `subteam` nas rows — de
  // modo que toda `option.key` exista em pelo menos uma row. Só calculado
  // quando o dropdown pode renderizar (isRoot && hierarchy, AC3 da S6); os ids
  // só coincidem com as rows na raiz (getStudentSubteamMap é sempre relativo
  // a `managerId`, nunca ao node focado).
  const teamFilterOptions: TeamFilterOption[] | undefined =
    isRoot && teamViewMode === "hierarchy"
      ? await resolveTeamFilterOptions(supabase, tenantId, managerId)
      : undefined

  const teamRecortePanel = (
    <section className="space-y-4 rounded-2xl bg-bg-card p-5 shadow-card">
      <TeamScopeControl
        trail={nav.trail}
        rootId={managerId}
        rootLabel="Meu Time"
        mode={teamViewMode}
        isRoot={isRoot}
        focusedLabel={focusedLabel}
        teamFilterOptions={teamFilterOptions}
      />

      <TeamMemberList buckets={engagementBuckets} subteamCounts={teamMemberSubteamCounts} />
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

/**
 * S6 (Onda 2): opções do filtro de time elevado ao recorte, derivadas do
 * MESMO universo de `getStudentSubteamMap` que preenche `subteam` nas rows
 * (mitigação (b) do Risco 3 da spec S6 — decisão registrada em spec-001,
 * NÃO usar `nav.subteams`). `undefined` quando não há sub-times (só Diretos
 * apareceria, e o dropdown já se auto-oculta com <= 1 opção).
 */
async function resolveTeamFilterOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  managerId: string,
): Promise<TeamFilterOption[] | undefined> {
  const subteamMap = await getStudentSubteamMap(supabase, tenantId, managerId)
  if (subteamMap.size === 0) return undefined

  const bySubteam = new Map<string, TeamFilterOption>()
  for (const assignment of subteamMap.values()) {
    const option = bySubteam.get(assignment.subteamId)
    if (option) {
      option.count = (option.count ?? 0) + 1
      continue
    }
    bySubteam.set(assignment.subteamId, {
      key: assignment.subteamId,
      label: assignment.subteamName || "Sem nome",
      count: 1,
      subteam: {
        id: assignment.subteamId,
        name: assignment.subteamName,
        colorIndex: assignment.colorIndex,
        path: assignment.path,
      },
    })
  }

  const options = [...bySubteam.values()].sort((a, b) => a.label.localeCompare(b.label))
  options.push({ key: DIRECT_TEAM_KEY, label: "Direto" })
  return options
}
