import { getTenantBySubdomain } from "@/lib/tenant"
import type { WhitelabelConfig } from "@eximia/shared"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenant = await getTenantBySubdomain()

  const wl: WhitelabelConfig | null =
    tenant?.whitelabel_enabled
      ? (tenant.whitelabel_config as WhitelabelConfig) ?? null
      : null

  const appName = wl?.custom_texts?.app_name || null
  const branding = (tenant?.branding as Record<string, string>) ?? {}
  const logoUrl = branding.logo_url || null

  return (
    <div className="relative flex min-h-screen bg-bg-app overflow-hidden">
      {/* Logo — top left, always visible */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 z-30">
        {logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={appName ?? "Academy"} style={{ height: 32 }} className="brightness-[1.8] drop-shadow-lg" />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-sm font-bold tracking-wide text-accent-teal">Academy</span>
          </div>
        ) : appName ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/eximia-symbol.svg" alt="exímIA" style={{ height: 28 }} />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-sm font-bold tracking-wide text-white">{appName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/eximia-horizontal.svg" alt="exímIA" style={{ height: 22 }} />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-sm font-bold tracking-wide text-accent-teal">Academy</span>
          </div>
        )}
      </div>

      {/* Left — image + overlay panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark overlay with brand gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-app/95 via-accent-blue-deep/80 to-bg-app/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-app via-transparent to-bg-app/60" />

        {/* Content */}
        <div className="relative z-10 max-w-md px-12 space-y-8 mt-12">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-lg">
              Aprenda com<br />inteligência.
            </h2>
            <p className="text-[15px] text-white/60 leading-relaxed">
              {wl?.custom_texts?.tagline || "Plataforma de ensino corporativo com IA socrática, cenários práticos e aprendizagem adaptativa."}
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["IA Socrática", "Cenários Práticos", "Quiz Adaptativo", "Analytics"].map((f) => (
              <span key={f} className="rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/50 backdrop-blur-sm">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Subtle background for mobile */}
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent-blue-mid/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-blue-mid/5 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-[380px]">
          {/* Spacer for top logo on mobile */}
          <div className="h-6 lg:hidden" />

          {children}

        </div>
      </div>

      {/* Footer — bottom of page */}
      <p className="absolute bottom-4 right-4 sm:bottom-5 sm:right-8 z-20 text-[10px] sm:text-[11px] text-text-muted/20">
        {wl?.footer_text || "\u00a9 2026 exímIA Academy"}
      </p>
    </div>
  )
}
