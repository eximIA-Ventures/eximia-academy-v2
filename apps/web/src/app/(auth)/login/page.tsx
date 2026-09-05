import { LoginForm } from "@/components/auth/login-form"
import { getTenantConfig } from "@/lib/tenant"
import { Suspense } from "react"

// D17 — a marca vem do HOST a cada requisição; prerenderizar esta rota
// serviria a marca de UMA empresa a TODAS (Full Route Cache).
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const config = await getTenantConfig()

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
