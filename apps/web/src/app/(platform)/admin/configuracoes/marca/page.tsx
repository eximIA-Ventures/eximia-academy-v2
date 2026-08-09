import { loadTenantSettings } from "@/app/(platform)/admin/settings/loader"
import { TenantRequiredState } from "@/components/admin/tenant-required-state"
import { WhitelabelSettingsForm } from "@/components/admin/whitelabel-settings-form"
import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesMarcaPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  const loaded = await loadTenantSettings()
  if (loaded.kind === "unauthenticated") redirect("/login")

  // FURO 4: permanece no mundo admin em vez de ser ejetado (ver o comentário
  // gêmeo em `organizacao/page.tsx` para a cadeia completa da ejeção).
  if (loaded.kind === "no-tenant") {
    const { roles } = await getAuthProfile()
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Marca & Aparência"
          description="Whitelabel: nome do app, textos do login, favicon e rodapé."
        />
        <TenantRequiredState canManageTenants={hasRole({ roles }, "super_admin")} />
      </div>
    )
  }

  const { tenant } = loaded

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Marca & Aparência"
        description="Whitelabel: nome do app, textos do login, favicon e rodapé."
      />

      {tenant.whitelabelEnabled ? (
        // Exatamente o mesmo componente da aba "Whitelabel" de /admin/settings.
        <WhitelabelSettingsForm tenantId={tenant.id} whitelabelConfig={tenant.whitelabelConfig} />
      ) : (
        // O gate de plano é o MESMO de hoje: a aba só existe com whitelabel
        // habilitado. Aqui ele vira um estado explícito em vez de um sumiço.
        <div className="rounded-2xl bg-bg-card p-8 text-center shadow-card">
          <h3 className="text-lg font-semibold text-text-primary">Recurso PRO</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
            A personalização de marca (whitelabel) não está habilitada no plano atual desta
            organização.
          </p>
        </div>
      )}
    </div>
  )
}
