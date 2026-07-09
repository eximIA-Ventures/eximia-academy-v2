// ---------------------------------------------------------------------------
// Engagement Center v2 — shared caller-scope resolution for the /api/engagement/*
// routes (E3). ONE source of truth so every route (overview, action, campaign,
// history) narrows to the SAME student universe the manager is currently viewing.
// ---------------------------------------------------------------------------
// The scope honours the SAME active context the standalone analytics page uses
// (analytics/page.tsx, admin/notifications/page.tsx): the `x-active-context`
// (personal/team/organization) cookie decides WHICH workspace the caller is
// looking at, then the `x-team-view` (direct/hierarchy) cookie picks
// direct-vs-subtree for a manager in the `team` context, otherwise the widest
// reach the caller's hats allow via resolveCallerStudentScope.
//
// WORKSPACE-SEPARATION (WP5, merge deploy/cory): the `x-role-lens` "Vendo como"
// switcher was RETIRED. The single truth "is this caller acting AS a manager?"
// is now: holds the `manager` hat AND the active context is `team` — exactly the
// `isManagerLensView = roleUnion.includes("manager") && activeCtx?.type === "team"`
// derivation the analytics page uses now (analytics/page.tsx). This preserves the
// engagement-coherence fix (BUG 2): a caller who holds BOTH admin and manager hats
// but is viewing the TEAM (Meu Time) is scoped to the manager SUBTREE, NOT
// tenant-wide, so the page (organization pill, N alunos) and this helper agree
// about who is in the recorte for the SAME caller. Since every /api/engagement/*
// route AND the page call THIS one function, deriving "acting as manager" from the
// active context here makes all surfaces agree. Admin outside the team context
// stays tenant-wide (null); a pure manager stays strictly scoped (unchanged).
//
// SECURITY: this resolves scope with the caller's AUTHENTICATED client. A forged
// cookie can only NARROW the set (it never widens reach): the manager branch is
// gated by auth.uid()-anchored RPCs (auth_reachable_student_ids /
// auth_subtree_user_ids) via getManagedTeamStudentIds, which fail-close to [] for
// a non-manager. The `team` context can only be entered by someone who genuinely
// reaches a team (authorizeContextAccess + RLS), so it cannot manufacture reach a
// non-manager lacks.
// ---------------------------------------------------------------------------

import { getActiveContextCookie } from "@/lib/context-context"
import { getTeamViewMode } from "@/lib/team-view-context"
import type { SupabaseClient } from "@supabase/supabase-js"

// biome-ignore lint/suspicious/noExplicitAny: authenticated RLS client, matches area-context primitives
type AuthClient = SupabaseClient<any, "public", any>

/**
 * Resolves the student universe the caller is CURRENTLY scoped to for engagement.
 *
 * Contract (mirrors resolveCallerStudentScope + the analytics page's team logic):
 *   • returns `null`  → tenant-wide (admin/super_admin only).
 *   • returns `[]`    → scoped caller with no reachable students (fail-closed).
 *   • returns [ids]   → the exact student ids in the current recorte.
 *
 * For a MANAGER in the `team` context, the switch (`x-team-view`) picks
 * direct-vs-subtree of the focused node — exactly like analytics/page.tsx. For
 * everyone else (or a manager outside `team`), it falls back to the widest
 * reach via resolveCallerStudentScope.
 */
export async function resolveEngagementScope(
  db: AuthClient,
  tenantId: string,
  userId: string,
  roles: string[],
): Promise<string[] | null> {
  const { getManagedTeamStudentIds, getDirectTeamStudentIds, resolveCallerStudentScope } =
    await import("@/lib/area-context")

  // ACTIVE CONTEXT first — the same workspace-separation resolution the analytics/
  // notifications pages use post-lens (WP5). "Acting AS manager" = holds the
  // `manager` hat AND the active context is `team` (Meu Time). An admin+manager
  // viewing the team is scoped as a manager; the same person outside the team
  // context (or a pure admin) remains tenant-wide.
  const activeContext = await getActiveContextCookie()
  const isTeamContext = activeContext?.type === "team"

  const isManager = roles.includes("manager")
  const isAdmin = roles.includes("admin") || roles.includes("super_admin")
  const managerContextActive = isManager && isTeamContext

  // Admin/super_admin NOT acting as manager (not in a team context) are tenant-wide
  // (null) — resolveCallerStudentScope returns null for them. When the manager
  // context IS active, fall through to the manager branch below so an admin+manager
  // viewing "Meu Time" is scoped to the subtree.
  if (isAdmin && !managerContextActive) {
    return resolveCallerStudentScope(db, tenantId, userId, roles)
  }

  if (isManager) {
    if (isTeamContext) {
      const teamViewMode = await getTeamViewMode()
      // The focused node for the drill-down is the manager's own root here; the
      // API surface does not carry a `?focus=` param (that is UI-page state), so
      // we scope to the manager's own root node, honouring only the switch. A
      // forged focus can't reach the API layer, so no extra gate is needed.
      if (teamViewMode === "hierarchy") {
        return (
          (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
        )
      }
      return getDirectTeamStudentIds(db, tenantId, userId)
    }
    // A manager OUTSIDE the team context (post-WP5, only a PURE manager reaches
    // here — an admin+manager outside `team` already returned tenant-wide above):
    // the widest reach is the whole managed subtree. Resolve via
    // getManagedTeamStudentIds DIRECTLY; it is auth.uid()-anchored, bound to THIS
    // caller, and fail-closes to [] (never tenant-wide) when they manage no one.
    return (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
  }

  // instructor / any other hat → resolveCallerStudentScope (union by area / []).
  return resolveCallerStudentScope(db, tenantId, userId, roles)
}
