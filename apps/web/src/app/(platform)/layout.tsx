import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PlatformFooter } from "@/components/layout/platform-footer"
import { Sidebar } from "@/components/layout/sidebar"
import { AreaProvider } from "@/components/providers/area-provider"
import { BrandProvider } from "@/components/providers/brand-provider"
import { ModuleProvider } from "@/components/providers/module-provider"
import { PostHogIdentify } from "@/components/providers/posthog-identify"
import { QueryProvider } from "@/components/providers/query-provider"
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider"
import { getActiveAreaId, getUserAreas } from "@/lib/area-context"
import { getAuthProfile } from "@/lib/auth"
import type { NavRole } from "@/lib/navigation"
import { getTenantConfig } from "@/lib/tenant"
import { sanitizeCSS } from "@/lib/utils/sanitize-css"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function sanitizeHex(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value) ? value : fallback
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const config = getTenantConfig()
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) {
    redirect("/login")
  }

  // Redirect to onboarding if not completed (students only)
  if (!profile.onboarding_completed && profile.role === "student") {
    redirect("/onboarding")
  }

  // Área context resolution (only when units module is enabled)
  let userAreas: Array<{ id: string; name: string; slug: string }> = []
  let activeArea: { id: string; name: string; slug: string } | null = null

  if (config.modules.includes("units")) {
    userAreas = await getUserAreas(user.id)
    const activeAreaId = await getActiveAreaId()

    if (activeAreaId) {
      activeArea = userAreas.find((a) => a.id === activeAreaId) ?? null
    }
    // When activeAreaId is null (cookie cleared via "Empresa"), keep activeArea as null
    // This allows the user to see data from all areas combined
  }

  // "View as student" mode (instructor, admin, super_admin)
  const viewAsStudent =
    (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")
      ? (await cookies()).get("x-view-as-student")?.value === "true"
      : false

  // Multi-tenant selector: super_admin or admin with null tenant_id
  let allTenants: Array<{ id: string; name: string; slug: string }> = []
  let activeTenantId: string | null = null
  const needsTenantSelector = profile.role === "super_admin" || (profile.role === "admin" && !profile.tenant_id)
  if (needsTenantSelector) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const { data } = await svc.from("tenants").select("id, name, slug").order("name")
    allTenants = data ?? []
    activeTenantId = (await cookies()).get("x-sa-active-tenant")?.value ?? allTenants[0]?.id ?? null
  }

  const primaryColor = sanitizeHex(config.brand.primaryColor, "#2a6ab0")
  const accentColor = sanitizeHex(config.brand.accentColor, "#C4A882")

  const sessionTimeoutHours = config.settings?.sessionTimeoutHours ?? 24
  const footerText = config.settings?.footerText
  const supportEmail = config.settings?.supportEmail
  const customCSS = config.settings?.customCSS ? sanitizeCSS(config.settings.customCSS) : ""

  return (
    <QueryProvider>
      <PostHogIdentify
        user={{
          id: user.id,
          role: profile.role,
          tenantId: config.brand.slug,
        }}
      />
      <ModuleProvider modules={config.modules}>
        <BrandProvider brand={config.brand}>
          <AreaProvider activeArea={activeArea} userAreas={userAreas}>
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered CSS vars with sanitized hex values
              dangerouslySetInnerHTML={{
                __html: `:root{--tenant-primary:${primaryColor};--tenant-secondary:${accentColor}}`,
              }}
            />
            {customCSS && (
              <style
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized custom CSS
                dangerouslySetInnerHTML={{ __html: customCSS }}
              />
            )}
            <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
              <NavigationProgress />
              <a
                href="#main-content"
                className="fixed left-4 top-4 z-[60] -translate-y-full rounded-md bg-cerrado-600 px-4 py-2 text-sm font-medium text-white opacity-0 transition-all focus:translate-y-0 focus:opacity-100 focus:outline-none"
                tabIndex={0}
              >
                Pular para o conteúdo principal
              </a>
              <div className="flex h-screen bg-bg-app font-sans text-text-primary">
                <Sidebar role={(viewAsStudent ? "student" : profile.role) as NavRole} />
                <div className="flex flex-1 flex-col min-w-0">
                  <Header
                    user={{ full_name: profile.full_name, role: profile.role }}
                    tenantContext={null}
                    multiTenant={needsTenantSelector ? { activeTenantId: activeTenantId ?? "", tenants: allTenants } : null}
                    viewAsStudent={viewAsStudent}
                  />
                  <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
                  <div aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer" />
                  <PlatformFooter footerText={footerText} supportEmail={supportEmail} />
                </div>
              </div>
            </SessionTimeoutProvider>
          </AreaProvider>
        </BrandProvider>
      </ModuleProvider>
    </QueryProvider>
  )
}
