import type { TenantConfig } from "@eximia/shared"

/**
 * Tenant configuration — customized per deployment branch.
 *
 * On `main`: defaults for local development.
 * On `deploy/{client}`: client-specific branding and modules.
 *
 * Core modules (academy, analytics, admin) are always active
 * regardless of what's listed here.
 */
const config: TenantConfig = {
  brand: {
    name: "eximIA Academy",
    slug: "demo",
    logo: "/brand/logo.png",
    favicon: "/brand/favicon.ico",
    primaryColor: "#2a6ab0",
    accentColor: "#C4A882",
  },
  modules: [
    // Add-on modules enabled for this tenant:
    // "assessments",
    // "biblioteca",
    // "community",
    // "course-designer",
    // "units",
    // "integrations",
  ],
  settings: {
    maxInteractionsPerSession: 10,
    sessionTimeoutHours: 24,
  },
}

export default config
