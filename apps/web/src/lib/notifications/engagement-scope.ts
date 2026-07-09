// ---------------------------------------------------------------------------
// Engagement Center v2 — shared caller-scope resolution for the /api/engagement/*
// routes (E3). ONE source of truth so every route (overview, action, campaign,
// history) narrows to the SAME student universe the manager is currently viewing.
// ---------------------------------------------------------------------------
// The scope honours the SAME active context AND the SAME "Vendo como" role lens
// the standalone analytics page uses (analytics/page.tsx, admin/notifications/
// page.tsx): the `x-role-lens` cookie decides which hat the caller is currently
// acting under, then the `x-active-context` (personal/team/organization) +
// `x-team-view` (direct/hierarchy) cookies pick direct-vs-subtree for a manager
// in the `team` context, otherwise the widest reach the caller's hats allow via
// resolveCallerStudentScope.
//
// LENS PRECEDENCE (fix — engagement scope coherence): a caller who holds BOTH
// admin and manager hats but is viewing "as Gestor" (`x-role-lens=manager`) must
// be scoped to the manager SUBTREE, NOT tenant-wide — exactly like the analytics
// dashboard resolves that same person (resolveRoleLens + isManagerLens). Before
// this, the admin branch short-circuited to null (tenant-wide) and IGNORED the
// active lens, so the page (organization pill, N alunos) and this helper could
// disagree about who is in the recorte for the SAME caller. Since every
// /api/engagement/* route AND the page call THIS one function, honouring the lens
// here makes all surfaces agree. Admin acting AS admin stays tenant-wide (null);
// a pure manager stays strictly scoped (unchanged).
//
// SECURITY: this resolves scope with the caller's AUTHENTICATED client. A forged
// cookie can only NARROW the set (it never widens reach): the manager-lens branch
// is gated by auth.uid()-anchored RPCs (auth_reachable_student_ids /
// auth_subtree_user_ids) via resolveCallerStudentScope, which fail-closed to []
// for a non-manager. The lens itself can only be set to "manager" when the caller
// genuinely holds the manager hat (eligibleRoleLenses), so it cannot manufacture
// reach a non-manager lacks.
// ---------------------------------------------------------------------------

import { getActiveContextCookie } from "@/lib/context-context"
import { getRoleLensCookie } from "@/lib/role-lens-context"
import { getTeamViewMode } from "@/lib/team-view-context"
import { isManagerLens, resolveRoleLens } from "@eximia/shared"
import type { Role } from "@eximia/shared"
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

  // ACTIVE LENS first — the same "Vendo como" resolution the analytics/
  // notifications pages use. `resolveRoleLens` honours the cookie only if the
  // caller genuinely holds that hat (eligibleRoleLenses), else the highest-
  // precedence eligible lens. A caller acting AS manager is scoped as a manager
  // even if they also hold admin; admin acting AS admin remains tenant-wide.
  const activeLens = resolveRoleLens(roles as Role[], await getRoleLensCookie())
  const managerLensActive = isManagerLens(activeLens)

  const isManager = roles.includes("manager")
  const isAdmin = roles.includes("admin") || roles.includes("super_admin")

  // Admin/super_admin acting AS admin (NOT under the manager lens) are tenant-wide
  // (null) — resolveCallerStudentScope returns null for them, and the team context
  // never applies. When the manager lens IS active, fall through to the manager
  // branch below so an admin+manager viewing "as Gestor" is scoped to the subtree.
  if (isAdmin && !managerLensActive) {
    return resolveCallerStudentScope(db, tenantId, userId, roles)
  }

  if (isManager || managerLensActive) {
    const activeContext = await getActiveContextCookie()
    const isTeamContext = activeContext?.type === "team"
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
    // Outside the team context, the widest reach (the whole managed subtree).
    // Resolve via getManagedTeamStudentIds DIRECTLY (not resolveCallerStudentScope),
    // because a caller who ALSO holds admin would take resolveCallerStudentScope's
    // admin shortcut and return null (tenant-wide) — defeating the active manager
    // lens. The subtree resolver is auth.uid()-anchored, so it is bound to THIS
    // caller and fail-closes to [] (never tenant-wide) when they manage no one.
    return (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
  }

  // instructor / any other hat → resolveCallerStudentScope (union by area / []).
  return resolveCallerStudentScope(db, tenantId, userId, roles)
}
