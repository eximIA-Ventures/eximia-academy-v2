import type { TenantConfig } from "@eximia/shared"

/**
 * Cory Alimentos — Tenant Configuration
 *
 * Unidades Gerenciais: RP (Ribeirão Preto) e MG (Minas Gerais)
 * Módulos habilitados: academy (core), analytics (core), admin (core),
 * assessments, biblioteca, units (Unidades Gerenciais)
 */
const config: TenantConfig = {
  brand: {
    name: "Cory Alimentos",
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
    footerText: "© 2026 Cory Alimentos · Powered by exímIA Academy",
    supportEmail: "suporte@eximiaventures.com.br",
  },
}

export default config
