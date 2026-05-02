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
  const { getTenantConfig } = await import("@/lib/tenant")

  try {
    const config = getTenantConfig()
    return {
      title: `${config.brand.name} — Academy`,
      description: "Plataforma de ensino com IA socrática",
      icons: { icon: config.brand.favicon || "/logos/eximia-symbol-blue.svg" },
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
