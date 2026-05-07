import type { TenantConfig } from "@eximia/shared"

/**
 * Cory Alimentos — Tenant Configuration
 *
 * Branding: Argos Consultoria (parceiro)
 * Unidades Gerenciais: RP (Ribeirão Preto) e MG (Minas Gerais)
 */
const config: TenantConfig = {
  brand: {
    name: "Argos Consultoria",
    slug: "cory",
    logo: "/brand/logo.png",
    favicon: "/brand/favicon.ico",
    primaryColor: "#1E3A5F",
    accentColor: "#C4A882",
    partnerName: "exímIA Ventures",
    partnerLogo: "/logos/eximia-horizontal-academy.svg",
  },
  modules: [
    "assessments",
    "biblioteca",
    "units",
  ],
  settings: {
    maxInteractionsPerSession: 10,
    sessionTimeoutHours: 24,
    footerText: "© 2026 Argos Consultoria · Powered by exímIA Academy",
    supportEmail: "suporte@eximiaventures.com.br",
  },
}

export default config
