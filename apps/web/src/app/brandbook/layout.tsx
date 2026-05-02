import type { Metadata } from "next"
import { Playfair_Display } from "next/font/google"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: "Argos Academy by exímIA — Design System",
  description: "Brandbook & Component Library · Overlens Design System",
  robots: "noindex, nofollow",
}

export default function BrandbookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-bg-app text-text-primary ${playfair.variable}`}>
      {children}
    </div>
  )
}
