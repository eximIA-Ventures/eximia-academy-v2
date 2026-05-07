import { getTenantConfig } from "@/lib/tenant"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const config = getTenantConfig()
  const { brand, settings } = config

  return (
    <div className="relative flex min-h-screen bg-bg-app overflow-hidden transition-colors duration-200">
      {/* Logo — top left, always visible */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 z-30">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt={brand.name} style={{ height: 32 }} className="brightness-0 invert drop-shadow-lg" />
          <div className="h-5 w-px bg-white/30" />
          <span className="text-lg font-bold text-cerrado-400" style={{ fontFamily: "var(--font-caveat), cursive" }}>Academy</span>
        </div>
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
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-cerrado-800/80 to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50" />

        {/* Content */}
        <div className="relative z-10 max-w-md px-12 space-y-8 mt-12">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-lg">
              Aprenda com<br />inteligencia.
            </h2>
            <p className="text-[15px] text-white/60 leading-relaxed">
              Plataforma de ensino corporativo com IA socratica, cenarios praticos e aprendizagem adaptativa.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["IA Socratica", "Cenarios Praticos", "Quiz Adaptativo", "Analytics"].map((f) => (
              <span key={f} className="rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/50 backdrop-blur-sm">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-[380px]">
          <div className="h-6 lg:hidden" />
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-4 right-4 sm:bottom-5 sm:right-8 z-20 text-[10px] sm:text-[11px] text-text-muted/40">
        {settings?.footerText || `\u00a9 2026 ${brand.name}`}
      </p>
    </div>
  )
}
