import { SettingsTabsWrapper } from "@/components/admin/settings-tabs-wrapper"
import { TenantRequiredState } from "@/components/admin/tenant-required-state"
import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { loadTenantSettings } from "./loader"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO.
  if (!canOpenAdminRoute("/admin/settings", roles)) return redirect("/dashboard")

  // Mesma leitura consumida pelas seções do hub (`/admin/configuracoes/*`):
  // um único loader, duas rotas, zero query duplicada.
  const loaded = await loadTenantSettings()
  if (loaded.kind === "unauthenticated") return redirect("/login")

  // FURO 4: `/admin/settings` pertence ao mundo admin (allowlist), então o
  // "sem tenant" não pode devolver a pessoa para fora dele. O
  // `redirect("/admin/tenants")` ejetava o admin global até `/dashboard`.
  if (loaded.kind === "no-tenant") {
    return (
      <div className="space-y-6">
        <PageHeader
          section="Administração"
          title="Configurações do Tenant"
          description="Personalize branding, modo de operação e funcionalidades da plataforma."
        />
        <TenantRequiredState canManageTenants={hasRole({ roles }, "super_admin")} />
      </div>
    )
  }

  const { tenant } = loaded

  // `?tab=` permite que um item de nav aponte para a ABA certa (ex.: o item
  // "Autenticação" do registry). Sem o parâmetro, nada muda: cai em "general".
  const rawTab = (await searchParams).tab
  const initialTab = Array.isArray(rawTab) ? rawTab[0] : rawTab

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Configurações do Tenant"
        description="Personalize branding, modo de operação e funcionalidades da plataforma."
        backgroundImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
      />

      <SettingsTabsWrapper
        whitelabelEnabled={tenant.whitelabelEnabled}
        tenantId={tenant.id}
        whitelabelConfig={tenant.whitelabelConfig}
        ssoConfigured={tenant.ssoConfigured}
        sessionTimeoutHours={tenant.sessionTimeoutHours}
        initialTab={initialTab}
        tenant={{
          id: tenant.id,
          name: tenant.name,
          branding: tenant.branding,
          settings: tenant.settings,
        }}
      />
    </div>
  )
}
