import { getAuthProfile } from "@/lib/auth"
import { getTenantConfig } from "@/lib/tenant"
import { accessibleWorkspaces, workspaceHomeRoute } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { WorkspacePicker } from "./_components/workspace-picker"

// D17 — a marca vem do HOST a cada requisição; prerenderizar esta rota
// serviria a marca de UMA empresa a TODAS (Full Route Cache).
export const dynamic = "force-dynamic"

export default async function WorkspacePickerPage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) redirect("/login")
  // 3º workspace (W1/W4): o chapéu admin-tier passou a CONCEDER mundos
  // (Administração + Padrão), então o desvio antigo — que tratava admin como
  // "sem workspace" e o mandava para /admin/tenants ou /dashboard — deixou de
  // existir. O admin agora escolhe a porta como todo mundo.
  const hats = roles as Role[]
  const ws = accessibleWorkspaces(hats)
  // Single-access users have no choice to make — go straight in (D1 picker is
  // only for multi-access). Defensive: middleware already routes this, but a
  // direct hit to /workspace must stay coherent.
  if (ws.length <= 1) redirect(workspaceHomeRoute(ws[0]))
  const firstName = profile.full_name?.split(" ")[0] ?? ""
  // A marca é resolvida AQUI, no servidor, e desce por prop: o picker é
  // `"use client"` e importar `@/lib/tenant` lá arrastaria a config para o
  // bundle do navegador — a amarra que prendia a identidade ao build.
  const { brand } = await getTenantConfig()
  return (
    <WorkspacePicker
      firstName={firstName}
      brand={{ name: brand.name, logo: brand.logo, logoLight: brand.logoLight }}
      canStudio={ws.includes("studio")}
      canStandard={ws.includes("standard")}
      canAdmin={ws.includes("admin")}
      canSuper={ws.includes("super")}
    />
  )
}
