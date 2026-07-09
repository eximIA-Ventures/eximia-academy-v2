"use server"

import { getAuthProfile } from "@/lib/auth"
import { clearActiveContext } from "@/lib/context-context"
import { type WorkspaceId, setActiveWorkspace } from "@/lib/workspace-context"
import { canAccessWorkspace, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

/** Cross-world travessia: validate REACH by hats, set the ephemeral workspace
 *  cookie, and CLEAR every residual state that belongs to the world being left
 *  (x-active-context, x-view-as-student, x-role-lens). This is the anti-
 *  residual-state rule (§3.1). Then land on the workspace home. */
export async function switchWorkspace(ws: WorkspaceId) {
  const { roles } = await getAuthProfile()
  if (!canAccessWorkspace(roles as Role[], ws)) {
    // Not reachable by this user's hats => fail-closed, do not switch.
    redirect("/workspace")
  }
  await setActiveWorkspace(ws)
  // Wipe residual axes so nothing leaks across the door.
  await clearActiveContext()
  const c = await cookies()
  if (c.get("x-view-as-student")) c.delete("x-view-as-student")
  // Role-lens axis retired (WP5); wipe any legacy cookie a browser still carries
  // so nothing leaks across the door. Inlined here now that role-lens-context.ts
  // is deleted.
  if (c.get("x-role-lens")) c.delete("x-role-lens")
  redirect(workspaceHomeRoute(ws))
}
