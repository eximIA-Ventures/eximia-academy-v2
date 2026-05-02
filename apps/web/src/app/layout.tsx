import { PostHogProvider } from "@/components/providers/posthog-provider"
import { ToastProvider } from "@/components/providers/toast-provider"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "@/styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export async function generateMetadata(): Promise<Metadata> {
  // Dynamic import to avoid circular dependency issues
  const { getTenantConfig } = await import("@/lib/tenant")

  try {
    const config = getTenantConfig(); const tenant = { name: config.brand.name, slug: config.brand.slug }
    const wl = tenant?.whitelabel_enabled
      ? (tenant.whitelabel_config as Record<string, unknown>)
      : null
    const customTexts = wl ? (wl.custom_texts as Record<string, string>) || {} : {}
    const faviconUrl = typeof wl?.favicon_url === "string" ? wl.favicon_url : null

    return {
      title: customTexts.app_name || "exímIA Academy",
      description: customTexts.tagline || "Plataforma de ensino com IA socrática",
      icons: { icon: faviconUrl || "/logos/eximia-symbol-blue.svg" },
    }
  } catch {
    return {
      title: "exímIA Academy",
      description: "Plataforma de ensino com IA socrática",
      icons: { icon: "/logos/eximia-symbol.svg" },
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        <PostHogProvider>
          <ToastProvider>{children}</ToastProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
