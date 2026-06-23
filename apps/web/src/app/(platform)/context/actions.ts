"use server"

import { createClient } from "@/lib/supabase/server"
import {
  clearActiveContext,
  setActiveContext,
  type ActiveContext,
} from "@/lib/context-context"
import { cookies } from "next/headers"

/**
 * Context server actions + reach authorization (E7 §4.5, §4.6).
 *
 * NON-NEGOTIABLE: the cookie NEVER grants. Every data decision flows through
 * `authorizeContextAccess` (server, ignores the client value) and, ultimately,
 * RLS. A forged team/organization out of reach degrades to "Minha Trilha" —
 * never an erroneous grant, never a manager shell over empty-but-elevated data.
 *
 * Absorption of view-as-student: switching/exiting context ALWAYS clears
 * `x-view-as-student`. The two mechanisms never coexist.
 */

/**
 * Validates that the requested context belongs to the person's REAL reach.
 * Mirrors `authorizeTenantAccess` (instructor/actions.ts:98): reads the profile
 * server-side, IGNORES the client value, returns the effective (narrowed)
 * context or null (denied => caller falls back to "Minha Trilha").
 *
 * Derives "organization" from `user_roles` (E1, the real hats), NOT from the
 * singular `profile.role`.
 */
export async function authorizeContextAccess(ctx: ActiveContext): Promise<ActiveContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  if (ctx.type === "team") {
    // Has a subtree? (E3). Under RLS — if the DB denies, there is no team to see.
    // (drill-down with a specific id and the `node ∈ auth_subtree_user_ids()`
    // gate is E9; here only the macro "does a team exist" check.)
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("reports_to", user.id)
    const hasTeam = (count ?? 0) > 0
    return hasTeam ? { type: "team", id: ctx.id ?? null } : null
  }

  if (ctx.type === "organization") {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id) // real hats (E1), not the singular role
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role)
    const isOrg = ["admin", "super_admin"].some((r) => roles.includes(r))
    return isOrg ? { type: "organization", id: ctx.id ?? null } : null
  }

  return null
}

export async function switchContext(ctx: ActiveContext) {
  const ok = await authorizeContextAccess(ctx) // server validates REACH
  if (!ok) {
    // denied => fall back to "Minha Trilha"
    await clearActiveContext()
    await clearViewAsStudent()
    return
  }
  await setActiveContext(ok)
  await clearViewAsStudent() // ABSORPTION: context wins; view-as-student goes away
  // No revalidatePath (pattern area/actions.ts:5-10); the client does router.refresh().
}

export async function exitContextMode() {
  // back to "Minha Trilha" — write the EXPLICIT `personal` sentinel so the choice
  // PERSISTS. Just clearing the cookie would leave the fresh state, and the
  // default ascent (highest-privilege context) would bounce a manager straight
  // back to "Meu Time". `personal` grants nothing: it only narrows the screen to
  // the student trail, which RLS already allows for any enrolled person.
  await setActiveContext({ type: "personal", id: null })
  await clearViewAsStudent()
}

async function clearViewAsStudent() {
  const c = await cookies()
  if (c.get("x-view-as-student")) c.delete("x-view-as-student") // instructor/actions.ts:8-15
}
