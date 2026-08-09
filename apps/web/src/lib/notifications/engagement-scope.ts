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
import { createServiceClient } from "@/lib/supabase/service"
import { getTeamViewMode } from "@/lib/team-view-context"
import type { SupabaseClient } from "@supabase/supabase-js"

// biome-ignore lint/suspicious/noExplicitAny: authenticated RLS client, matches area-context primitives
type AuthClient = SupabaseClient<any, "public", any>

// Guards a `?focus=` node id before it reaches the gated subtree resolvers.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * SECURITY GUARD (Crivo review, T1 rodada 1, 2026-07-18) — `manager_group_members`
 * has NO role constraint at the DB level, and (until migration
 * 20260718120000_fix_auth_direct_student_ids_hat_gap.sql is deployed)
 * `auth_direct_student_ids`'s membership branch didn't verify the student HAT
 * either — a manager (or an admin curating a team) can add ANY user as a
 * "member", including one who never held the student hat (e.g. an
 * instructor-only user). The three SIBLING RPCs (`auth_reachable_student_ids`,
 * `auth_subtree_user_ids`, `subtree_student_ids`) are NOT versioned in this
 * repo (applied to prod outside the tracked migration flow — see
 * 20260702222743's docblock), so their current SQL can't be audited from
 * source; this guard covers them too, as defence in depth, regardless of what
 * they do internally.
 *
 * Without this guard, a non-student member would be silently treated as a
 * student everywhere the resolved scope feeds (Engagement actions/nudges,
 * Analytics, engagement metrics) — visible to the manager, nudgeable, counted.
 *
 * This is a LAST-LINE, SERVICE-CLIENT check (bypasses RLS on purpose — same
 * recipe as the multi-chapéu fix in `dispatchTeamNudge`, engine.ts) that
 * intersects the resolved candidate ids against `user_roles` before they leave
 * this module. It can only NARROW an already-resolved scope, never widen it —
 * fails closed (empty) on a read error rather than trusting unverified ids.
 */
async function filterToStudentHat(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const svc = createServiceClient()
  const { data, error } = await svc
    .from("user_roles")
    .select("user_id")
    .eq("role", "student")
    .in("user_id", ids)
  if (error) {
    console.error("[engagement-scope] filterToStudentHat failed — fail-closed to empty:", error)
    return []
  }
  return [...new Set((data ?? []).map((r) => r.user_id as string))]
}

/**
 * Extracts a validated drill-down `?focus=` node id from a request URL, for the
 * /api/engagement/* routes to feed into resolveEngagementScope (Rodada 3). A
 * malformed/absent value returns null (the manager's own root). This never
 * grants reach — resolveEngagementScope's own gate re-checks the node against
 * the caller's subtree; this is only shape validation at the edge.
 */
export function readFocusParam(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("focus")
  return raw && UUID_RE.test(raw) ? raw : null
}

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
  /**
   * DRILL-DOWN focus (Rodada 3, 2026-07-09): the id of the subtree node the
   * manager has drilled INTO (from the page/API `?focus=` param). When present
   * and inside the caller's own subtree, the recorte is resolved AT THAT NODE
   * instead of at the manager's own root — mirroring analytics/page.tsx's E9
   * drill-down. `null`/absent = the manager's own root (the previous behaviour,
   * so every existing 4-arg call-site is byte-for-byte unchanged). SECURITY: a
   * forged/out-of-scope focus can only NARROW (getSubtreeStudentIdsAtNode /
   * getDirectTeamStudentIds gate `node ∈ auth_subtree_user_ids()` and fail-close
   * to []), never widen reach.
   */
  focus?: string | null,
): Promise<string[] | null> {
  const {
    getManagedTeamStudentIds,
    getDirectTeamStudentIds,
    getSubtreeStudentIdsAtNode,
    resolveCallerStudentScope,
  } = await import("@/lib/area-context")

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
    // A manager (pure, or admin+manager in a team context — an admin+manager
    // OUTSIDE `team` already returned tenant-wide above) is scoped to their team.
    //
    // RODADA 3 (Hugo 2026-07-09): the in-team and fresh-state (outside-team, no
    // x-active-context cookie yet) paths used to DIVERGE — in-team honoured the
    // Diretos/Hierarquia switch, but fresh-state UNCONDITIONALLY returned the whole
    // managed subtree (includeSubtree). That divergence is exactly why a manager
    // landing fresh saw the flattened Hierarquia instead of "Meu Time"/Diretos.
    // The two paths are now UNIFIED and both honour `getTeamViewMode()` (default
    // "direct") + the drill-down `?focus=`:
    //
    //   • teamViewMode "direct" (DEFAULT)  → the focused node's DIRECT reports.
    //   • teamViewMode "hierarchy"         → the focused node's whole subtree.
    //     At the root with no focus we keep the `auth_reachable_student_ids`
    //     includeSubtree path (the exact set the canonical-scope test pins); a
    //     drilled node uses the gated per-node resolver (mirrors analytics/page.tsx).
    //
    // The focused node defaults to the manager's own root; a `?focus=` node is
    // gated inside getSubtreeStudentIdsAtNode / getDirectTeamStudentIds
    // (`node ∈ auth_subtree_user_ids()`, fail-closed to []), so a forged focus can
    // only NARROW — never widen. The canonical-scope test forces
    // getTeamViewMode()→"hierarchy" and so still resolves the full subtree; only
    // the fresh/Diretos default changes behaviour.
    void isTeamContext // retained above only to gate the admin tenant-wide short-circuit
    const teamViewMode = await getTeamViewMode()
    const node = focus && UUID_RE.test(focus) ? focus : userId
    const focusedAtRoot = node === userId
    // Every manager-branch result below is sourced (directly or via an RPC) from
    // manager_group_members / the subtree RPCs, none of which are guaranteed to
    // verify the student hat on every path — filterToStudentHat is the guard
    // (see its docblock). Applied uniformly here so no manager branch can forget it.
    if (teamViewMode === "hierarchy") {
      if (focusedAtRoot) {
        const ids =
          (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
        return filterToStudentHat(ids)
      }
      return filterToStudentHat(await getSubtreeStudentIdsAtNode(db, tenantId, node))
    }
    return filterToStudentHat(await getDirectTeamStudentIds(db, tenantId, node))
  }

  // instructor / any other hat → resolveCallerStudentScope (union by area / []).
  return resolveCallerStudentScope(db, tenantId, userId, roles)
}
