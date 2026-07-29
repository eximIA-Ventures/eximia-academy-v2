import type { TenantConfig } from "@eximia/shared"

/**
 * Vértice Indústria — Tenant Configuration (demonstração)
 *
 * Branding: Vértice Indústria
 * Deploy dedicado de demonstração: vertice.eximiaacademy.com.br
 */
const config: TenantConfig = {
  brand: {
    name: "Vértice Indústria",
    slug: "vertice-industria",
    logo: "/brand/logo.png",
    favicon: "/brand/favicon.ico",
    primaryColor: "#1E3A5F",
    accentColor: "#C4A882",
    partnerName: "exímIA Ventures",
    partnerLogo: "/logos/eximia-horizontal-academy.svg",
  },
  modules: [
    "biblioteca",
    "units",
  ],
  settings: {
    maxInteractionsPerSession: 10,
    sessionTimeoutHours: 24,
    footerText: "© 2026 Vértice Indústria · Powered by exímIA Academy",
    supportEmail: "suporte@eximiaventures.com.br",
  },
}

export default config
