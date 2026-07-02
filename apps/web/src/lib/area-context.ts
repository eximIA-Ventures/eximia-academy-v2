import { getInstructorAreaIds } from "@/lib/api-auth/instructor-permissions"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const AREA_COOKIE = "x-active-area"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getActiveAreaId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(AREA_COOKIE)?.value ?? null
}

export async function setActiveArea(areaId: string) {
  if (!UUID_RE.test(areaId)) return
  const cookieStore = await cookies()
  cookieStore.set(AREA_COOKIE, areaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearActiveArea() {
  const cookieStore = await cookies()
  cookieStore.delete(AREA_COOKIE)
}

/**
 * Resolves the set of STUDENT ids that belong to a managerial unit (area).
 *
 * This is the reusable scope primitive behind the header Unidade selector: pass
 * the active area id and the function returns the student universe to narrow any
 * dashboard/report to that unit. Mirrors the "unit" scope in
 * `/api/analytics/aggregate` (resolveScopeStudentIds) so the SSR page and the
 * client API describe the SAME population.
 *
 * Contract:
 *   • returns `null`  → no scoping (no area selected / "Todas" → whole tenant)
 *   • returns `[]`    → area selected but it has zero students
 *   • returns [ids]   → the student ids in that unit (role=student only)
 *
 * `db` accepts either the RLS client or the service client, so callers that must
 * bypass RLS (analytics SSR) and callers that don't can share the same helper.
 */
export async function getAreaStudentIds(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS/service client, matches lib/supabase/service.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  areaId: string | null | undefined,
): Promise<string[] | null> {
  if (!areaId || !UUID_RE.test(areaId)) return null
  // Defensive: a missing tenant would silently match nothing — treat as no scope.
  if (!tenantId) return null

  const { data: links } = await db.from("user_areas").select("user_id").eq("area_id", areaId)
  const candidateIds = [...new Set((links ?? []).map((r) => r.user_id as string))]
  if (candidateIds.length === 0) return []

  // user_areas links instructors/admins too — restrict to role=student so the
  // realized universe matches the "students" population the dashboard counts.
  const { data: studentRows } = await db
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .in("id", candidateIds)
  return [...new Set((studentRows ?? []).map((r) => r.id as string))]
}

/**
 * Options controlling {@link getManagedTeamStudentIds}. Additive (options bag) so
 * the existing 3-arg call-sites keep compiling and produce the same result (AC2).
 */
export interface ManagedTeamScopeOptions {
  /**
   * E9 (EPIC-30) — SUBTREE aggregation switch.
   *   • false / absent (default) → CURRENT behaviour: only the explicit members
   *     of the `manager_groups` this manager OWNS (no corporate fan-out, no
   *     subtree). The two existing call-sites rely on this — DO NOT regress.
   *   • true → UNION ALWAYS (decision D2, no CLIFF): the manager's whole
   *     `reports_to` subtree ∪ the members of every descendant `manager_group`,
   *     resolved by the E3 SQL function `auth_reachable_student_ids()`
   *     (SECURITY DEFINER, RLS-safe, auto-excludes the manager).
   *
   * HARD CONSTRAINT: `auth_reachable_student_ids()` is hard-wired to `auth.uid()`
   * (E3). So `includeSubtree:true` is ONLY correct when `db` is the AUTHENTICATED
   * client of the manager themselves — NEVER the service client, never another
   * person's id. `managerId` still validates the caller; the RPC ignores it (a
   * forged id can't widen the set — that path is the drill-down, see
   * {@link getSubtreeStudentIdsAtNode}).
   */
  includeSubtree?: boolean
}

/**
 * Resolves the set of STUDENT ids that belong to the TEAM(s) a manager OWNS.
 *
 * Team scope primitive (ÁREA/GESTOR), the sibling of `getAreaStudentIds`
 * (UNIDADE). It resolves the `manager_groups` whose `manager_id = managerId`,
 * then the explicit members listed in `manager_group_members`. There is NO
 * corporate fan-out: `manager_group_units` / `is_corporate` are intentionally
 * ignored, so the scope is exactly the explicit team membership (see EPIC §6).
 *
 * E9 ADDITIVE — when `opts.includeSubtree` is true, the universe instead becomes
 * the manager's whole subtree (UNION ALWAYS, no CLIFF) via the E3 function
 * `auth_reachable_student_ids()`. The default (no opts) is byte-for-byte the
 * previous behaviour (AC2).
 *
 * Contract (mirrors `getAreaStudentIds`):
 *   • returns `null`  → no team scope: the manager owns zero groups, or the
 *                       args are invalid (missing/non-UUID managerId, no tenant).
 *                       In the subtree branch, an RPC error also degrades to
 *                       `null` so the manager caller collapses it to [] (AC4).
 *   • returns `[]`    → the manager owns group(s) but they have zero members
 *                       (default branch); or the subtree resolved to no students.
 *   • returns [ids]   → distinct student ids (owned teams, or the whole subtree).
 *
 * `db` accepts either the RLS client or the service client (same signature as
 * `getAreaStudentIds`) for the DEFAULT branch. The SUBTREE branch REQUIRES the
 * authenticated client (auth.uid() == managerId) — see ManagedTeamScopeOptions.
 */
export async function getManagedTeamStudentIds(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS/service client, matches lib/supabase/service.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  managerId: string | null | undefined,
  opts: ManagedTeamScopeOptions = {}, // E9 — default {} preserves the 3-arg call-sites (AC2).
): Promise<string[] | null> {
  if (!managerId || !UUID_RE.test(managerId)) return null
  // Defensive: a missing tenant would silently match nothing — treat as no scope.
  if (!tenantId) return null

  // E9 — SUBTREE branch (UNION ALWAYS, no CLIFF). The E3 function resolves the
  // reports_to subtree ∪ descendant manager_group members, dedups, and auto-
  // excludes the manager. It is hard-wired to auth.uid(), so `db` MUST be the
  // manager's authenticated client (enforced by the caller; see options doc).
  if (opts.includeSubtree) {
    const { data, error } = await db.rpc("auth_reachable_student_ids")
    if (error) return null // degrade to "no scope"; the manager caller collapses to [] (AC4)
    return [...new Set((data ?? []) as string[])]
  }

  // --- DEFAULT branch (unchanged): manager_groups owned → manager_group_members.
  // (a) Resolve the teams this manager OWNS, scoped to the tenant.
  const { data: groups } = await db
    .from("manager_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("manager_id", managerId)
  const groupIds = [...new Set((groups ?? []).map((g) => g.id as string))]
  // Manager owns no team → no team scope at all (distinct from "team with no
  // members", which yields [] below).
  if (groupIds.length === 0) return null

  // (b) Resolve the explicit members of those teams, scoped to the tenant.
  // Only manager_group_members is consulted — no corporate fan-out.
  const { data: members } = await db
    .from("manager_group_members")
    .select("student_id")
    .eq("tenant_id", tenantId)
    .in("group_id", groupIds)
  return [...new Set((members ?? []).map((m) => m.student_id as string))]
}

/**
 * TEAM-VIEW SWITCH (Hierarquia) — the student universe DIRECTLY under `node`,
 * with NO subtree flattening. Sibling of `getManagedTeamStudentIds` (Visão
 * Global, which flattens the WHOLE reachable subtree) and
 * {@link getSubtreeStudentIdsAtNode} (drill-down, also full subtree of a node).
 *
 * "Direct" = the union of:
 *   (a) students with `users.reports_to = node` (organograma direto), and
 *   (b) students explicitly listed in `manager_group_members` for every
 *       `manager_groups` row owned by `node` (`manager_id = node`).
 * This is exactly the DEFAULT branch of `getManagedTeamStudentIds` for (b),
 * plus a `reports_to` read for (a) — no new primitive, just the union that was
 * already latent (opts.includeSubtree=false + reports_to).
 *
 * SECURITY: this does NOT grant new reach. It queries `users`/`manager_groups`/
 * `manager_group_members` under the AUTHENTICATED RLS client, so `node` must
 * already be inside the caller's authorized subtree — callers gate `node`
 * against `auth_subtree_user_ids()` (see {@link getSubtreeStudentIdsAtNode} /
 * `resolveDrilldownNav`) BEFORE calling this, exactly like the existing
 * drill-down. Direct-only is a SUBSET of the full subtree, never a superset.
 *
 * Contract:
 *   • returns `[]` → `node` is invalid/missing, or has zero direct students.
 *   • returns [ids] → distinct student ids directly under `node` (role=student).
 */
export async function getDirectTeamStudentIds(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS/service client, matches area-context.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  node: string | null | undefined,
): Promise<string[]> {
  if (!node || !UUID_RE.test(node) || !tenantId) return []

  // (a) Direct reports (organograma), restricted to role=student — mirrors the
  // role filter in getAreaStudentIds so the "direct team" population matches
  // what the rest of the dashboard means by "student".
  const { data: directReportRows } = await db
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .eq("reports_to", node)

  // (b) Explicit members of the manager_groups OWNED by `node` — same query
  // shape as the DEFAULT branch of getManagedTeamStudentIds (no fan-out).
  const { data: groups } = await db
    .from("manager_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("manager_id", node)
  const groupIds = [...new Set((groups ?? []).map((g) => g.id as string))]

  let groupMemberIds: string[] = []
  if (groupIds.length > 0) {
    const { data: members } = await db
      .from("manager_group_members")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .in("group_id", groupIds)
    groupMemberIds = (members ?? []).map((m) => m.student_id as string)
  }

  const union = new Set<string>()
  for (const r of directReportRows ?? []) union.add(r.id as string)
  for (const id of groupMemberIds) union.add(id)
  return [...union]
}

/**
 * E9 (EPIC-30) — SECURE DRILL-DOWN: the student universe rooted at `node`, but
 * ONLY if `node` belongs to the caller's own subtree (the E3 membership gate).
 *
 * The order is INEGOTIABLE and identical at every call-site (this single helper):
 *   1. `auth_subtree_user_ids()`  → the nodes the caller may focus on
 *   2. `has(node)`                → GATE: forged / out-of-subtree node fails here
 *   3. `subtree_student_ids(node)`→ only reached after the gate passes
 *
 * A node outside the subtree, an invalid UUID, or a missing tenant returns `[]`
 * (FAIL-CLOSED), never `null`, never tenant-wide. Forging `node` cannot widen the
 * set: the gate denies it here, and even if it didn't, the E4 RLS policies would
 * return zero rows for another subtree (defence in depth — AC6/AC7).
 *
 * `db` MUST be the manager's AUTHENTICATED client: both E3 functions read
 * `auth.uid()`. Do NOT pass the service client to this helper.
 */
export async function getSubtreeStudentIdsAtNode(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS client, matches getManagedTeamStudentIds
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  node: string | null | undefined,
): Promise<string[]> {
  if (!node || !UUID_RE.test(node) || !tenantId) return []
  // GATE — node must be in the caller's subtree BEFORE any drill resolution.
  const { data: subtreeUsers } = await db.rpc("auth_subtree_user_ids")
  if (!new Set((subtreeUsers ?? []) as string[]).has(node)) return [] // forged / out-of-scope → []
  const { data, error } = await db.rpc("subtree_student_ids", { _node: node })
  return error ? [] : [...new Set((data ?? []) as string[])]
}

export async function getUserAreas(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_areas")
    .select("area_id, areas(id, name, slug)")
    .eq("user_id", userId)

  return (data ?? []).map((row) => {
    const area = row.areas as unknown as { id: string; name: string; slug: string }
    return { id: area.id, name: area.name, slug: area.slug }
  })
}

/**
 * UNIFIED CALLER → DISPATCH SCOPE for the engagement layer.
 *
 * Single source of truth for "which students may THIS caller reach with a
 * nudge/notification". It composes the EXISTING scope primitives above — it does
 * NOT introduce any new scoping rule. Every engagement dispatch endpoint
 * (suggestions/generate, suggestions/[id] approve, notifications/nudge) resolves
 * its reach through this helper so the non-leakage invariant is enforced in ONE
 * place, the same philosophy as the campaign / manager-nudge travas.
 *
 * Policy by role:
 *   • admin / super_admin → `null` = NO restriction (tenant-wide). UNCHANGED:
 *     the existing tenant-wide behaviour of the engine is preserved exactly.
 *   • manager → the manager's OWN team subtree via
 *     `getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })`,
 *     collapsing `null` (owns no team) to `[]`. REQUIRES `db` to be the manager's
 *     AUTHENTICATED client (the subtree branch reads auth.uid()).
 *   • instructor → the UNION of the students of every area the instructor is
 *     assigned to: `getInstructorAreaIds(userId, tenantId)` → for each areaId,
 *     `getAreaStudentIds(db, tenantId, areaId)` → deduped. This is composition of
 *     the existing UNIDADE primitive, NOT a new rule.
 *   • any other role → `[]` (FAIL-CLOSED: zero recipients, NEVER tenant-wide).
 *
 * Contract:
 *   • returns `null`  → tenant-wide (admin/super_admin only).
 *   • returns `[]`    → scoped caller with no reachable students (fail-closed).
 *   • returns [ids]   → the exact student universe this caller may dispatch to.
 *
 * The caller is responsible for the auth/role gate BEFORE calling this; here we
 * only translate (already-authenticated) role → student universe. The returned
 * value is meant to be passed as `allowedStudentIds` to the engine, where a
 * non-null array is intersected with the resolved roster before dispatch.
 */
export async function resolveCallerStudentScope(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed authenticated RLS client, matches the primitives above
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  userId: string,
  role: string,
): Promise<string[] | null> {
  // admin / super_admin → tenant-wide (null = no restriction). UNCHANGED.
  if (role === "admin" || role === "super_admin") return null

  // manager → own team subtree. `getManagedTeamStudentIds` with includeSubtree
  // reads auth.uid(), so `db` MUST be the manager's authenticated client.
  if (role === "manager") {
    return (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
  }

  // instructor → union of the students across every assigned area (composition of
  // the UNIDADE primitive). Empty assignment → [] (fail-closed).
  if (role === "instructor") {
    const areaIds = await getInstructorAreaIds(userId, tenantId)
    if (areaIds.length === 0) return []
    const perArea = await Promise.all(
      areaIds.map((areaId) => getAreaStudentIds(db, tenantId, areaId)),
    )
    const union = new Set<string>()
    for (const ids of perArea) {
      // getAreaStudentIds returns null only for an invalid/absent areaId — here the
      // ids come from getInstructorAreaIds, so treat null defensively as "no students".
      for (const id of ids ?? []) union.add(id)
    }
    return [...union]
  }

  // any other role → fail-closed (zero recipients, NEVER tenant-wide).
  return []
}
