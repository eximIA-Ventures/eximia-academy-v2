import { PostHogProvider } from "@/components/providers/posthog-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ToastProvider } from "@/components/providers/toast-provider"
import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono, Caveat } from "next/font/google"
import "@/styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600"],
})

export async function generateMetadata(): Promise<Metadata> {
  const { getTenantConfig } = await import("@/lib/tenant")

  try {
    const config = getTenantConfig()
    return {
      title: `${config.brand.name} — Academy`,
      description: "Plataforma de ensino com IA socratica",
      icons: { icon: config.brand.favicon || "/logos/eximia-symbol-blue.svg" },
    }
  } catch {
    return {
      title: "eximIA Academy",
      description: "Plataforma de ensino com IA socratica",
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
    <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.remove('dark');else if(window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <PostHogProvider>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
