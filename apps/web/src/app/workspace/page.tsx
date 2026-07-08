import { getAuthProfile } from "@/lib/auth"
import { accessibleWorkspaces, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { WorkspacePicker } from "./_components/workspace-picker"

const WORKSPACE_HATS: Role[] = ["instructor", "student", "manager", "leader"]

export default async function WorkspacePickerPage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) redirect("/login")
  // Admin tiers without any workspace hat keep their own landing — /workspace
  // is the universal post-login door (OAuth/SSO included), so it must route
  // them out instead of dropping them on the standard fallback.
  const hats = roles as Role[]
  if (!hats.some((r) => WORKSPACE_HATS.includes(r))) {
    if (hats.includes("super_admin")) redirect("/super-admin/tenants")
    if (hats.includes("admin")) redirect("/dashboard")
  }
  const ws = accessibleWorkspaces(hats)
  // Single-access users have no choice to make — go straight in (D1 picker is
  // only for multi-access). Defensive: middleware already routes this, but a
  // direct hit to /workspace must stay coherent.
  if (ws.length <= 1) redirect(workspaceHomeRoute(ws[0]))
  const firstName = profile.full_name?.split(" ")[0] ?? ""
  return (
    <WorkspacePicker
      firstName={firstName}
      canStudio={ws.includes("studio")}
      canStandard={ws.includes("standard")}
    />
  )
}
