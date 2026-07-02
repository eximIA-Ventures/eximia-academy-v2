import { cookies } from "next/headers"

/**
 * Team-view cookie (`x-team-view`) — the "Hierarquia / Visão Global" switch
 * inside the `team` context (Meu Time). Mirrors `context-context.ts` exactly
 * (8h maxAge, httpOnly/secure/sameSite), scoped to a small enum instead of
 * UUIDs.
 *
 * NON-NEGOTIABLE: this cookie is a UI hint ONLY, same as `x-active-context`.
 * It NEVER grants access — it only picks which SLICE of the already-authorized
 * subtree to render:
 *   • "direct"  (DEFAULT) → only the direct members of the focused node, via
 *     `getDirectTeamStudentIds`.
 *   • "global"  → the whole reachable subtree of the focused node, via the
 *     existing `getManagedTeamStudentIds({includeSubtree:true})` /
 *     `getSubtreeStudentIdsAtNode` (E9, unchanged).
 * Authorization of the node itself (`focus`) is untouched — this switch only
 * decides direct-vs-subtree AFTER the node is already gated.
 *
 * ABSENCE of the cookie = "direct" (the new default), per product spec.
 */

const TEAM_VIEW_COOKIE = "x-team-view"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours — mirrors context-context.ts:26

export type TeamViewMode = "direct" | "global"

export async function getTeamViewMode(): Promise<TeamViewMode> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(TEAM_VIEW_COOKIE)?.value
  return raw === "global" ? "global" : "direct" // default: direct (Hierarquia)
}

export async function setTeamViewMode(mode: TeamViewMode) {
  if (mode !== "direct" && mode !== "global") return // refuse malformed input
  const cookieStore = await cookies()
  cookieStore.set(TEAM_VIEW_COOKIE, mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearTeamViewMode() {
  const cookieStore = await cookies()
  cookieStore.delete(TEAM_VIEW_COOKIE)
}
