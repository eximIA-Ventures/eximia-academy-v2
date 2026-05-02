import { LoginForm } from "@/components/auth/login-form"
import type { WhitelabelConfig } from "@eximia/shared"
import { Suspense } from "react"

export default async function LoginPage() {
  const { brand } = getTenantConfig(); const tenant = { branding: { logo_url: brand.logo }, whitelabel_config: null, whitelabel_enabled: false }

  const wl: WhitelabelConfig | null =
    tenant?.whitelabel_enabled
      ? (tenant.whitelabel_config as WhitelabelConfig) ?? null
      : null

  // Story 8.2: Extract SSO config from tenant settings
  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const ssoProviderId = (settings.sso_provider_id as string) || null
  const ssoDomain = (settings.sso_domain as string) || null

  return (
    <Suspense>
      <LoginForm
        loginTitle={wl?.custom_texts?.login_title}
        loginSubtitle={wl?.custom_texts?.login_subtitle}
        hasTenant={!!tenant}
        tenantSlug={tenant?.slug ?? null}
        ssoProviderId={ssoProviderId}
        ssoDomain={ssoDomain}
      />
    </Suspense>
  )
}
