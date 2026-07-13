import type { WorkspaceId } from "@/lib/workspace-context"
import type { Role } from "@eximia/shared"

/** Which worlds a person may enter, derived from the union of hats (E1).
 *  instructor hat => Estúdio; student/manager hat => Padrão. Order is stable
 *  (studio first) so single-access resolution is deterministic. Never empty for
 *  a real user: anyone reaching the platform holds at least one of these hats;
 *  as a defensive floor, a hatless user resolves to ["standard"]. */
export function accessibleWorkspaces(roles: Role[]): WorkspaceId[] {
  const out: WorkspaceId[] = []
  if (roles.includes("instructor")) out.push("studio")
  if (roles.includes("student") || roles.includes("manager") || roles.includes("leader"))
    out.push("standard")
  if (out.length === 0) out.push("standard")
  return out
}

/** True when the person can enter the given world. */
export function canAccessWorkspace(roles: Role[], ws: WorkspaceId): boolean {
  return accessibleWorkspaces(roles).includes(ws)
}

/** The landing route for a workspace. Studio => /instructor; Padrão => /dashboard. */
export function workspaceHomeRoute(ws: WorkspaceId): string {
  return ws === "studio" ? "/instructor" : "/dashboard"
}
