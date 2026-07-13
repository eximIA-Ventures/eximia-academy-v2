import { cookies } from "next/headers"

/**
 * Team-view cookie (`x-team-view`) — the "Diretos / Hierarquia" switch inside
 * the `team` context (Meu Time). Mirrors `context-context.ts` exactly (8h
 * maxAge, httpOnly/secure/sameSite), scoped to a small enum instead of UUIDs.
 *
 * NON-NEGOTIABLE: this cookie is a UI hint ONLY, same as `x-active-context`.
 * It NEVER grants access — it only picks which SLICE of the already-authorized
 * subtree to render:
 *   • "direct"    (DEFAULT) → only the direct members of the focused node, via
 *     `getDirectTeamStudentIds`. Mental model: "meu time" primeiro.
 *   • "hierarchy" → the whole reachable subtree of the focused node, via the
 *     existing `getManagedTeamStudentIds({includeSubtree:true})` /
 *     `getSubtreeStudentIdsAtNode` (E9, unchanged). Mental model: "o que está
 *     abaixo do meu time".
 * Authorization of the node itself (`focus`) is untouched — this switch only
 * decides direct-vs-subtree AFTER the node is already gated.
 *
 * ABSENCE of the cookie = "direct" (the default), per product spec.
 *
 * RENAME (Iteração 2, 2026-07-02): the cookie's stored value used to be
 * "global" — renamed to "hierarchy" for clarity ("Hierarquia" = a estrutura
 * ABAIXO dos meus diretos, não "global"). A legacy "global" value that may
 * still be sitting in a browser (8h cookie, so short-lived) is treated as
 * "hierarchy" on read — same semantics, just the old label.
 */

const TEAM_VIEW_COOKIE = "x-team-view"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours — mirrors context-context.ts:26

export type TeamViewMode = "direct" | "hierarchy"

export async function getTeamViewMode(): Promise<TeamViewMode> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(TEAM_VIEW_COOKIE)?.value
  // "global" = legacy stored value (pre-rename) — treated as "hierarchy".
  return raw === "hierarchy" || raw === "global" ? "hierarchy" : "direct" // default: direct
}

export async function setTeamViewMode(mode: TeamViewMode) {
  if (mode !== "direct" && mode !== "hierarchy") return // refuse malformed input
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
