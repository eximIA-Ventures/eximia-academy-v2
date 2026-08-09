import { loadTenantSettings } from "@/app/(platform)/admin/settings/loader"
import { SSOConfigForm } from "@/components/admin/sso-config-form"
import { TenantRequiredState } from "@/components/admin/tenant-required-state"
import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

const TITLE = "Segurança & Sessão"
const DESCRIPTION = "Login único (SSO/SAML) e tempo de expiração da sessão."

export default async function ConfiguracoesSegurancaPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  // A rota antiga `/admin/settings?tab=auth` segue VIVA e sem redirect.
  const loaded = await loadTenantSettings()
  if (loaded.kind === "unauthenticated") redirect("/login")

  // FURO 4: permanece no mundo admin em vez de ser ejetado (ver o comentário
  // gêmeo em `organizacao/page.tsx` para a cadeia completa da ejeção).
  if (loaded.kind === "no-tenant") {
    const { roles } = await getAuthProfile()
    return (
      <div className="space-y-6">
        <SectionHeader title={TITLE} description={DESCRIPTION} />
        <TenantRequiredState canManageTenants={hasRole({ roles }, "super_admin")} />
      </div>
    )
  }

  const { tenant } = loaded

  return (
    <div className="space-y-6">
      <SectionHeader title={TITLE} description={DESCRIPTION} />

      {/* EXATAMENTE o conteúdo da aba "Autenticação" de `/admin/settings`: o
          mesmo `SSOConfigForm`, alimentado pelo MESMO `loadTenantSettings`. A
          aba antiga continua existindo; aqui ela sobe sem a moldura de abas
          (as outras duas abas já são seções próprias do hub: "Configurações
          Gerais" não tem tela editável e "Whitelabel" é "Marca & Aparência"). */}
      <SSOConfigForm
        ssoConfigured={tenant.ssoConfigured}
        tenantId={tenant.id}
        sessionTimeoutHours={tenant.sessionTimeoutHours}
      />
    </div>
  )
}
