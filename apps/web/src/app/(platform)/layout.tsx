import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PlatformFooter } from "@/components/layout/platform-footer"
import { Sidebar } from "@/components/layout/sidebar"
import { AreaProvider } from "@/components/providers/area-provider"
import { PostHogIdentify } from "@/components/providers/posthog-identify"
import { QueryProvider } from "@/components/providers/query-provider"
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider"
import { TenantProvider } from "@/components/providers/tenant-provider"
import { TenantSlugProvider } from "@/components/providers/tenant-slug-provider"
import type { TenantSettings } from "@/components/providers/tenant-provider"
import { getActiveAreaId, getUserAreas } from "@/lib/area-context"
import { getUserTenants } from "@/lib/actions/tenant-switch"
import { getAuthProfile } from "@/lib/auth"
import type { NavRole } from "@/lib/navigation"
import { getSuperAdminTenantContext } from "@/lib/super-admin-context"
import { getTenantSlugFromHeaders } from "@/lib/tenant-nav"
import { sanitizeCSS } from "@/lib/utils/sanitize-css"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function sanitizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  return HEX_COLOR_RE.test(value) ? value : fallback
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenantSlug = await getTenantSlugFromHeaders()
  const { user, profile } = await getAuthProfile()

  if (!user) {
    redirect(tenantSlug ? `/${tenantSlug}/login` : "/login")
  }

  if (!profile) {
    redirect(tenantSlug ? `/${tenantSlug}/login` : "/login")
  }

  // Epic 5 — Story 5.3: Redirect to onboarding if not completed (students only)
  if (!profile.onboarding_completed && profile.role === "student") {
    redirect(tenantSlug ? `/${tenantSlug}/onboarding` : "/onboarding")
  }

  // Epic 11 — Story 11.4: Super admin with active tenant cookie loads that tenant's data
  let tenant: Record<string, unknown>
  if (profile.role === "super_admin") {
    const cookieStore = await cookies()
    const activeTenantId = cookieStore.get("x-sa-active-tenant")?.value
    if (!activeTenantId) {
      redirect("/super-admin/tenants")
    }
    const saContext = await getSuperAdminTenantContext(activeTenantId)
    if (!saContext) {
      redirect("/super-admin/tenants")
    }
    tenant = saContext as Record<string, unknown>
  } else {
    const tenantRaw = profile.tenants
    tenant = ((Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw) || {
      id: "",
      name: "exímIA Academy",
      slug: "default",
      branding: {},
      settings: {},
    }) as Record<string, unknown>
  }

  // Validate tenant access: ensure user belongs to the URL tenant
  if (tenantSlug && profile.role !== "super_admin") {
    const tenantId = tenant.id as string
    if (tenantId && profile.tenant_id !== tenantId) {
      // User's active tenant doesn't match URL — try auto-switch via membership
      const { createServiceClient } = await import("@/lib/supabase/service")
      const service = createServiceClient()
      const { data: membership } = await service
        .from("user_tenant_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .single()

      if (membership) {
        // Auto-switch active tenant
        await service.from("users").update({ tenant_id: tenantId }).eq("id", user.id)
      } else {
        // No access — redirect to user's own tenant
        const { data: userTenant } = await service
          .from("tenants")
          .select("slug")
          .eq("id", profile.tenant_id)
          .single()

        if (userTenant?.slug) {
          redirect(`/${userTenant.slug}/dashboard`)
        } else {
          redirect(`/${tenantSlug}/login?error=no_access`)
        }
      }
    }
  }

  // Área context resolution
  let userAreas: Array<{ id: string; name: string; slug: string }> = []
  let activeArea: { id: string; name: string; slug: string } | null = null

  if (profile.role !== "super_admin") {
    userAreas = await getUserAreas(user.id)
    const activeAreaId = await getActiveAreaId()

    if (activeAreaId) {
      activeArea = userAreas.find((a) => a.id === activeAreaId) ?? null
    }

    // Default to first area if none selected (cookie set lazily via ÁreaSelector)
    if (!activeArea && userAreas.length > 0) {
      activeArea = userAreas[0]
    }
  }

  // Multi-tenant: fetch user's tenant memberships for switcher
  const userTenants = profile.role !== "super_admin" ? await getUserTenants() : []

  // "View as student" mode (instructor, admin, super_admin)
  const viewAsStudent = (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")
    ? (await cookies()).get("x-view-as-student")?.value === "true"
    : false

  const branding = (tenant.branding as Record<string, unknown>) || {}
  const settings = (tenant.settings as Record<string, unknown>) || {}
  const sessionTimeoutHours =
    typeof settings.session_timeout_hours === "number" && settings.session_timeout_hours > 0
      ? settings.session_timeout_hours
      : 24 // Default: 24h session timeout when not configured
  const primaryColor = sanitizeHex(branding.primary_color, "#2a6ab0")
  const secondaryColor = sanitizeHex(branding.secondary_color, "#1e1e1e")

  // Story 11.6: Whitelabel footer + custom CSS
  const whitelabelEnabled = tenant.whitelabel_enabled as boolean | undefined
  const whitelabelConfig = (tenant.whitelabel_config as Record<string, unknown>) || {}
  const footerText =
    typeof whitelabelConfig.footer_text === "string" ? whitelabelConfig.footer_text : undefined
  const supportEmail =
    typeof whitelabelConfig.support_email === "string" ? whitelabelConfig.support_email : undefined
  const customCSS =
    typeof whitelabelConfig.custom_css === "string" ? sanitizeCSS(whitelabelConfig.custom_css) : ""

  return (
    <QueryProvider>
      <PostHogIdentify
        user={{
          id: user.id,
          role: profile.role,
          tenantId: tenant.id as string,
        }}
      />
      <TenantSlugProvider slug={tenantSlug}>
      <TenantProvider
        tenant={{
          id: tenant.id as string,
          name: tenant.name as string,
          slug: tenant.slug as string,
          branding: {
            logo_url: typeof branding.logo_url === "string" ? branding.logo_url : undefined,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
          },
          settings: settings as TenantSettings,
        }}
      >
        <AreaProvider activeArea={activeArea} userAreas={userAreas}>
          <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered tenant CSS vars with sanitized hex values
            dangerouslySetInnerHTML={{
              __html: `:root{--tenant-primary:${primaryColor};--tenant-secondary:${secondaryColor}}`,
            }}
          />
          {whitelabelEnabled && customCSS && (
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized custom CSS from whitelabel config
              dangerouslySetInnerHTML={{ __html: customCSS }}
            />
          )}
          <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
            <NavigationProgress />
            <a
              href="#main-content"
              className="fixed left-4 top-4 z-[60] -translate-y-full rounded-md bg-accent-blue-mid px-4 py-2 text-sm font-medium text-white opacity-0 transition-all focus:translate-y-0 focus:opacity-100 focus:outline-none"
              tabIndex={0}
            >
              Pular para o conteúdo principal
            </a>
            <div className="flex h-screen bg-bg-app font-sans text-text-primary">
              <Sidebar role={(viewAsStudent ? "student" : profile.role) as NavRole} />
              <div className="flex flex-1 flex-col min-w-0">
                <Header
                  user={{ full_name: profile.full_name, role: profile.role }}
                  tenantContext={
                    profile.role === "super_admin" ? { name: tenant.name as string } : null
                  }
                  multiTenant={
                    userTenants.length > 1
                      ? { activeTenantId: tenant.id as string, tenants: userTenants }
                      : null
                  }
                  viewAsStudent={viewAsStudent}
                />
                <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
                <div aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer" />
                <PlatformFooter footerText={footerText} supportEmail={supportEmail} />
              </div>
            </div>
          </SessionTimeoutProvider>
        </AreaProvider>
      </TenantProvider>
      </TenantSlugProvider>
    </QueryProvider>
  )
}
