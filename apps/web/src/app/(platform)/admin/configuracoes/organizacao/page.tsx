import { loadTenantSettings } from "@/app/(platform)/admin/settings/loader"
import { TenantRequiredState } from "@/components/admin/tenant-required-state"
import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { OrgDataForm } from "../_components/org-data-form"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesOrganizacaoPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  const loaded = await loadTenantSettings()
  if (loaded.kind === "unauthenticated") redirect("/login")

  // FURO 4: sem tenant resolvido a pessoa PERMANECE no mundo admin, com um
  // estado honesto. O `redirect("/admin/tenants")` que existia aqui ejetava o
  // admin global para `/dashboard` (via o guard super_admin-only de tenants),
  // e `/dashboard` reescreve o cookie de workspace para `standard`.
  if (loaded.kind === "no-tenant") {
    const { roles } = await getAuthProfile()
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Dados da organização"
          description="Nome e identidade visual da organização, aplicados em toda a plataforma."
        />
        <TenantRequiredState canManageTenants={hasRole({ roles }, "super_admin")} />
      </div>
    )
  }

  const { tenant } = loaded

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dados da organização"
        description="Nome e identidade visual da organização, aplicados em toda a plataforma."
      />

      <OrgDataForm
        tenantId={tenant.id}
        initialName={tenant.name}
        initialLogoUrl={tenant.branding.logo_url}
        initialPrimaryColor={tenant.branding.primary_color}
        initialSecondaryColor={tenant.branding.secondary_color}
      />
    </div>
  )
}
