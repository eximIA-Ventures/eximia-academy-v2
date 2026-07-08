// ---------------------------------------------------------------------------
// Engagement Center v2 — shared caller-scope resolution for the /api/engagement/*
// routes (E3). ONE source of truth so every route (overview, action, campaign,
// history) narrows to the SAME student universe the manager is currently viewing.
// ---------------------------------------------------------------------------
// The scope honours the SAME active context the standalone analytics page uses
// (analytics/page.tsx): the `x-active-context` (personal/team/organization) +
// `x-team-view` (direct/hierarchy) cookies for a manager in the `team` context,
// otherwise the widest reach the caller's hats allow via resolveCallerStudentScope.
//
// SECURITY: this resolves scope with the caller's AUTHENTICATED client. A forged
// cookie can only NARROW the set (it never widens reach): every branch is gated
// by auth.uid()-anchored RPCs (auth_reachable_student_ids / auth_subtree_user_ids)
// or resolveCallerStudentScope, which fail-closed to [] for non-privileged hats.
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

  const isManager = roles.includes("manager")
  const isAdmin = roles.includes("admin") || roles.includes("super_admin")

  // Admin/super_admin are tenant-wide (null) — resolveCallerStudentScope already
  // returns null for them, and the team context never applies.
  if (isAdmin) return resolveCallerStudentScope(db, tenantId, userId, roles)

  if (isManager) {
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
    // Outside the team context, the widest reach (whole subtree).
    return resolveCallerStudentScope(db, tenantId, userId, roles)
  }

  // instructor / any other hat → resolveCallerStudentScope (union by area / []).
  return resolveCallerStudentScope(db, tenantId, userId, roles)
}
