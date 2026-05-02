import { LoginForm } from "@/components/auth/login-form"
import { getTenantConfig } from "@/lib/tenant"
import { Suspense } from "react"

export default async function LoginPage() {
  const config = getTenantConfig()

  return (
    <Suspense>
      <LoginForm
        loginTitle={undefined}
        loginSubtitle={undefined}
        hasTenant={true}
        tenantSlug={config.brand.slug}
        ssoProviderId={null}
        ssoDomain={null}
      />
    </Suspense>
  )
}
