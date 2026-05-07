import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getAuthProfile()

  if (!user) {
    redirect("/login")
  }

  if (!profile) {
    redirect("/login")
  }

  if (profile.onboarding_completed) {
    redirect("/dashboard")
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-app overflow-hidden font-sans text-text-primary">
      {/* Ambient accent blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-accent-gold/[0.04] blur-3xl" />
      </div>

      {/* Dot-grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full">
        {/* Logo + product divider */}
        <div className="mb-2 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Academy"
            className="h-10"
          />
          <span className="mt-1 text-lg font-bold text-cerrado-600" style={{ fontFamily: "var(--font-caveat), cursive" }}>Academy</span>
        </div>

        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  )
}
