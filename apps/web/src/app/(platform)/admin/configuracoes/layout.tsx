import { loadTenantSettings } from "@/app/(platform)/admin/settings/loader"
import { getAuthProfile } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { SettingsHubNav } from "./_components/settings-hub-nav"

/**
 * Shell do hub de Configurações da organização.
 *
 * Fica DENTRO do route group `(platform)` existente: os providers
 * (QueryProvider, ModuleProvider, BrandProvider, AreaProvider, ContextProvider,
 * SessionTimeoutProvider), o Header e o CSS de tenant já são montados por
 * `(platform)/layout.tsx`. Aqui só entra a segunda coluna (a sidebar do hub).
 *
 * Guard: admin-tier pela UNIÃO DE CHAPÉUS (`roles[]`), nunca pelo `profile.role`
 * singular legado (E7 §4.10 — contexto/coluna singular não decide permissão).
 * `getAuthProfile` é `cache()`-ado, então não duplica query com o layout pai.
 */
export default async function ConfiguracoesHubLayout({ children }: { children: ReactNode }) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) redirect("/login")
  if (!hasAnyRole({ roles }, ["admin", "super_admin"])) redirect("/dashboard")

  // CFG-4.1 (AC1) — o selo "PRO" na barra sai do MESMO gate que a sub-rota de
  // marca já usa (`loadTenantSettings().tenant.whitelabelEnabled`), nunca de uma
  // segunda leitura de plano; duas fontes divergiriam na primeira edição.
  //
  // O try/catch não é decoração: `loadTenantSettings` LANÇA quando a query de
  // tenant falha, e aqui isso derrubaria as 9 seções do hub por causa de um selo
  // — hoje este layout não lança em nenhum caminho. Falha degrada para "sem
  // selo" (o default do componente); a sub-rota de marca continua sendo quem
  // reporta o erro de verdade, exatamente como antes desta linha existir.
  let whitelabelEnabled = true
  try {
    const loaded = await loadTenantSettings()
    if (loaded.kind === "ok") whitelabelEnabled = loaded.tenant.whitelabelEnabled
  } catch {
    whitelabelEnabled = true
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 rounded-2xl bg-bg-card p-4 shadow-card lg:sticky lg:top-6 lg:w-72">
        <h1 className="px-3 text-lg font-bold text-text-primary">Configurações</h1>
        <p className="mb-4 px-3 text-xs text-text-muted">Administração da organização</p>
        <SettingsHubNav whitelabelEnabled={whitelabelEnabled} />
      </aside>

      <section className="min-w-0 flex-1">{children}</section>
    </div>
  )
}
