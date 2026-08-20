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

import {
  getDirectTeamStudentIds,
  getManagedTeamStudentIds,
  getSubtreeStudentIdsAtNode,
} from "@/lib/area-context"
import { getTeamEngagementBuckets } from "@/lib/engagement-helpers"
import { resolveDrilldownNav } from "@/lib/org-tree"
import type { createClient } from "@/lib/supabase/server"
import { resolveTeamFilterOptions } from "@/lib/team-filter-options"
import { getTeamViewMode } from "@/lib/team-view-context"
import { ManagerDashboardPage } from "./manager-dashboard-page"
import type { TeamFilterOption } from "./team-filter-dropdown"
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
  // quando o dropdown pode renderizar: na RAIZ, porque os ids só coincidem com
  // as rows lá (getStudentSubteamMap é sempre relativo a `managerId`, nunca ao
  // node focado).
  //
  // Hugo (2026-08-12): a trava `teamViewMode === "hierarchy"` (AC3 da S6) caiu
  // por decisão de produto — o dropdown aparece nos dois modos. Isto é seguro
  // porque `getStudentSubteamMap` deriva da estrutura de subordinados do
  // gestor (auth_subtree_user_ids + reports_to), NÃO do recorte
  // direct/hierarchy: a lista de sub-times é a mesma nos dois modos. Quem
  // muda com o modo é a POPULAÇÃO das rows, e disso cuida o consumidor
  // (manager-dashboard-page.tsx, que agora resolve `subteam` nas rows também
  // em Diretos, senão a seleção não mordia nada).
  const teamFilterOptions: TeamFilterOption[] | undefined = isRoot
    ? await resolveTeamFilterOptions(supabase, tenantId, managerId)
    : undefined

  // Nº de alunos do recorte ativo, exibido no topo do card (Hugo 2026-07-07:
  // o card "Alunos analisados" saiu do grid de triagem). Espelha EXATAMENTE a
  // resolução de escopo de manager-dashboard-page.tsx (mesmas RPCs gated).
  // Trade-off consciente: 1 RPC duplicada por render (o filho resolve de novo)
  // em troca de manter os slots sem inversão de árvore; se divergir do
  // triageSummary do filho (ex.: membro sem chapéu student), a diferença é de
  // pouquíssimas unidades e o número do topo é o do ESCOPO, não da tabela.
  const analyzedIds =
    teamViewMode === "hierarchy"
      ? isRoot
        ? await getManagedTeamStudentIds(supabase, tenantId, managerId, { includeSubtree: true })
        : await getSubtreeStudentIdsAtNode(supabase, tenantId, nav.focusUserId)
      : await getDirectTeamStudentIds(supabase, tenantId, nav.focusUserId ?? managerId)
  const analyzedCount = (analyzedIds ?? []).length

  // C2 (fidelidade ao mockup): este bloco não é mais dono do próprio
  // fundo/sombra, o card externo em <ManagerDashboard> (isTeamView) agrupa
  // recorte + cards de triagem no MESMO container branco, como no mockup.
  const teamRecortePanel = (
    <div className="space-y-4">
      <TeamScopeControl
        trail={nav.trail}
        rootId={managerId}
        rootLabel="Meu Time"
        mode={teamViewMode}
        isRoot={isRoot}
        focusedLabel={focusedLabel}
        teamFilterOptions={teamFilterOptions}
        analyzedCount={analyzedCount}
      />

      <TeamMemberList buckets={engagementBuckets} subteamCounts={teamMemberSubteamCounts} />
    </div>
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
