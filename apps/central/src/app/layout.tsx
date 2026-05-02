import type { Metadata } from "next"
import "../globals.css"

export const metadata: Metadata = {
  title: "eximIA Academy — Central",
  description: "Painel de gestão de tenants e módulos da eximIA Academy",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-bg-app text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
