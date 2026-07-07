import { BrandProvider } from "@/components/providers/brand-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider"
import { StudioHeader } from "@/components/studio/studio-header"
import { StudioSidebar } from "@/components/studio/studio-sidebar"
import { StudioViewAsStudentBar } from "@/components/studio/studio-view-as-student-bar"
import { getAuthProfile } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { getTenantConfig } from "@/lib/tenant"
import { sanitizeCSS } from "@/lib/utils/sanitize-css"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function sanitizeHex(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value) ? value : fallback
}

/**
 * Studio root layout — the instructor-only workspace shell.
 *
 * PARALLEL to (platform)/layout.tsx, deliberately ENXUTO: only the providers the
 * Studio actually needs (Brand, Query, SessionTimeout). NOTHING from the standard
 * world leaks in — no ContextProvider (população), no AreaProvider (the studio has
 * no unit selector; the instructor dashboard reads the area cookie server-side on
 * its own), no RoleLensSwitcher. The role IS the place here (workspace = identity).
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const config = getTenantConfig()
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) redirect("/login")

  // Fail-closed by REAL hat, mirrors the middleware and instructor/page.tsx: a
  // non-instructor never renders the Studio shell (the Rinaldo case relies on the
  // union of hats, never on the singular profile.role).
  if (!hasAnyRole({ roles }, ["instructor"])) redirect("/dashboard")

  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  const firstName = profile.full_name?.split(" ")[0] ?? ""

  const primaryColor = sanitizeHex(config.brand.primaryColor, "#2a6ab0")
  const accentColor = sanitizeHex(config.brand.accentColor, "#C4A882")
  const sessionTimeoutHours = config.settings?.sessionTimeoutHours ?? 24
  const customCSS = config.settings?.customCSS ? sanitizeCSS(config.settings.customCSS) : ""

  return (
    <QueryProvider>
      <BrandProvider brand={config.brand}>
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
          <div className="flex h-screen bg-bg-app font-sans text-text-primary">
            <StudioSidebar />
            <div className="flex flex-1 flex-col min-w-0">
              {viewAsStudent && <StudioViewAsStudentBar />}
              <StudioHeader
                firstName={firstName}
                fullName={profile.full_name ?? ""}
                viewAsStudent={viewAsStudent}
              />
              <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                {children}
              </main>
            </div>
          </div>
        </SessionTimeoutProvider>
      </BrandProvider>
    </QueryProvider>
  )
}
