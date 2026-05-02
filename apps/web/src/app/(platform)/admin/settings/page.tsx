import { SettingsTabsWrapper } from "@/components/admin/settings-tabs-wrapper"
import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  // Resolve tenant_id: super_admin uses active tenant cookie, others use profile.tenant_id
  const tenantId =
    profile.role === "super_admin"
      ? await getActiveTenantForSuperAdmin()
      : profile.tenant_id

  if (!tenantId) redirect("/super-admin/tenants")

  // Load full tenant data for admin settings (including whitelabel fields)
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, branding, settings, plan, whitelabel_enabled, whitelabel_config",
    )
    .eq("id", tenantId)
    .single()

  if (error || !tenant) {
    throw new Error("Falha ao carregar dados do tenant")
  }

  const branding = (tenant.branding as Record<string, string>) || {}
  const settings = (tenant.settings as Record<string, unknown>) || {}
  const features = (settings.features as Record<string, boolean>) || {}

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Configurações do Tenant"
        description="Personalize branding, modo de operação e funcionalidades da plataforma."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
      />

      <SettingsTabsWrapper
        whitelabelEnabled={!!tenant.whitelabel_enabled}
        tenantId={tenant.id}
        whitelabelConfig={
          (tenant.whitelabel_config as Record<string, unknown>) || {}
        }
        ssoConfigured={!!settings.sso_provider_id}
        sessionTimeoutHours={
          typeof settings.session_timeout_hours === "number"
            ? settings.session_timeout_hours
            : 8
        }
        tenant={{
          id: tenant.id,
          name: tenant.name,
          branding: {
            logo_url: branding.logo_url || undefined,
            primary_color: branding.primary_color || "#2a6ab0",
            secondary_color: branding.secondary_color || "#1e1e1e",
          },
          settings: {
            max_interactions_per_session:
              typeof settings.max_interactions_per_session === "number"
                ? settings.max_interactions_per_session
                : 3,
            ai_model:
              typeof settings.ai_model === "string"
                ? settings.ai_model
                : "claude-sonnet-4-5",
            features: {
              ai_detection: features.ai_detection ?? false,
              learning_journal: features.learning_journal ?? false,
              certificates: features.certificates ?? false,
              analytics_dashboard: features.analytics_dashboard ?? true,
            },
          },
        }}
      />
    </div>
  )
}
