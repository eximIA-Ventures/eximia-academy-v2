import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PlatformFooter } from "@/components/layout/platform-footer"
import { Sidebar } from "@/components/layout/sidebar"
import { AreaProvider } from "@/components/providers/area-provider"
import { BrandProvider } from "@/components/providers/brand-provider"
import { ContextProvider } from "@/components/providers/context-provider"
import { ModuleProvider } from "@/components/providers/module-provider"
import { PostHogIdentify } from "@/components/providers/posthog-identify"
import { QueryProvider } from "@/components/providers/query-provider"
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider"
import { getActiveAreaId, getUserAreas } from "@/lib/area-context"
import { getAuthProfile } from "@/lib/auth"
import { resolveContext } from "@/lib/context-resolver"
import { hasAnyRole, hasRole } from "@/lib/role-helpers"
import { unreadCount } from "@/lib/notifications/inbox"
import { getTenantConfig } from "@/lib/tenant"
import { sanitizeCSS } from "@/lib/utils/sanitize-css"
import type { Role } from "@eximia/shared"
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
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) {
    redirect("/login")
  }

  // Capability profile (E1 union of hats). All view/visibility checks use
  // hasRole/hasAnyRole over this — NEVER `profile.role` equality (E8 AC1/AC8).
  const capabilityProfile = { roles }

  // Redirect to onboarding if not completed (students only)
  if (!profile.onboarding_completed && profile.role === "student") {
    redirect("/onboarding")
  }

  // Área context resolution (only when units module is enabled)
  let userAreas: Array<{ id: string; name: string; slug: string }> = []
  let activeArea: { id: string; name: string; slug: string } | null = null

  if (config.modules.includes("units")) {
    // Staff (by CAPABILITY) see ALL tenant areas; others see only assigned areas.
    const isStaff = hasAnyRole(capabilityProfile, ["instructor", "admin", "super_admin", "manager"])
    if (isStaff && profile.tenant_id) {
      const { createClient } = await import("@/lib/supabase/server")
      const sb = await createClient()
      const { data: allAreas } = await sb
        .from("areas")
        .select("id, name, slug")
        .eq("tenant_id", profile.tenant_id)
        .order("name")
      userAreas = (allAreas ?? []).map((a) => ({ id: a.id, name: a.name, slug: a.slug }))
    } else {
      userAreas = await getUserAreas(user.id)
    }
    const activeAreaId = await getActiveAreaId()

    if (activeAreaId) {
      activeArea = userAreas.find((a) => a.id === activeAreaId) ?? null
    }
    // When activeAreaId is null (cookie cleared via "Empresa"), keep activeArea as null
    // This allows the user to see data from all areas combined
  }

  // Active context (E7): resolved AFTER area (place first, context second —
  // E7 §4.8). Reuses the getAuthProfile cache (no duplicate query). `active` is
  // the safe default ("Minha Trilha") when no elevated cookie is present.
  // "View as student" is ABSORBED here: the student view is now the `personal`
  // context (`isSelfContext`); no more `x-view-as-student`-derived boolean.
  const { active: activeContext, available: availableContexts } = await resolveContext()
  const isSelfContext = activeContext.type === "personal"

  // Multi-tenant selector: super_admin or admin with null tenant_id
  let allTenants: Array<{ id: string; name: string; slug: string }> = []
  let activeTenantId: string | null = null
  const needsTenantSelector =
    profile.role === "super_admin" || (profile.role === "admin" && !profile.tenant_id)
  if (needsTenantSelector) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const { data } = await svc.from("tenants").select("id, name, slug").order("name")
    allTenants = data ?? []
    activeTenantId = (await cookies()).get("x-sa-active-tenant")?.value ?? allTenants[0]?.id ?? null
  }

  // Pre-fetch unread count for the bell badge (non-blocking; defaults to 0 on
  // error). Shown for students (by capability) and anyone in the personal
  // ("Minha Trilha") context — covers the gestor-aluno in self context.
  const initialUnreadCount =
    hasRole(capabilityProfile, "student") || isSelfContext
      ? await unreadCount().catch(() => 0)
      : 0

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
            <ContextProvider value={{ active: activeContext, available: availableContexts }}>
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
                <div className="flex h-screen bg-bg-app font-sans text-text-primary">
                  <Sidebar context={activeContext} roles={roles as Role[]} />
                  <div className="flex flex-1 flex-col min-w-0">
                    <Header
                      user={{ full_name: profile.full_name, roles: roles as Role[] }}
                      tenantContext={null}
                      multiTenant={
                        needsTenantSelector
                          ? { activeTenantId: activeTenantId ?? "", tenants: allTenants }
                          : null
                      }
                      activeContext={activeContext}
                      availableContexts={availableContexts}
                      initialUnreadCount={initialUnreadCount}
                    />
                    <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                      {children}
                    </main>
                    <div
                      aria-live="polite"
                      aria-atomic="true"
                      className="sr-only"
                      id="route-announcer"
                    />
                    <PlatformFooter footerText={footerText} supportEmail={supportEmail} />
                  </div>
                </div>
              </SessionTimeoutProvider>
            </ContextProvider>
          </AreaProvider>
        </BrandProvider>
      </ModuleProvider>
    </QueryProvider>
  )
}
