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

/**
 * Which shell the (platform) route group must render for a request (BUG-2).
 *
 * The Studio nav ("Meus Cursos", "Conteúdo e Materiais", "Sessões e Lives",
 * "Acompanhamento", "Análises") deliberately links to SHARED pages that live in
 * the (platform) route group (/courses, /materiais, /lives, /trails, /analytics)
 * — only /instructor lives in (studio). Because Next.js route groups do not share
 * a layout, those pages would otherwise render the STANDARD shell, flipping the
 * instructor into "Plataforma de Aprendizagem" and losing the Estúdio he came
 * from. This decides the shell by the ACTIVE workspace, not by the route group.
 *
 * Fail-closed: a forged `studio` cookie without the real instructor hat resolves
 * to the standard shell (mirrors switchWorkspace/canAccessWorkspace). Absent or
 * standard workspace => standard shell.
 */
export function resolvePlatformShell(
  activeWorkspace: WorkspaceId | null,
  roles: Role[],
): WorkspaceId {
  if (activeWorkspace === "studio" && roles.includes("instructor")) return "studio"
  return "standard"
}

/**
 * Whether course-authoring actions ("Criar Curso", "Criar Blueprint", "Importar
 * com IA") may appear on /courses (BUG-2 side effect). Authoring belongs to the
 * Estúdio: it requires BOTH the active studio workspace AND the real instructor
 * hat. In the standard world (student "Minha Trilha" or manager context) nobody
 * authors — the old gating leaked because it keyed off the singular role alone.
 */
export function canAuthorCourses(activeWorkspace: WorkspaceId | null, roles: Role[]): boolean {
  return activeWorkspace === "studio" && roles.includes("instructor")
}
