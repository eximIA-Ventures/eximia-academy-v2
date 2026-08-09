import type { ModuleId } from "./registry"

// ---------------------------------------------------------------------------
// Tenant configuration — read from tenant.config.ts at app root
// ---------------------------------------------------------------------------

export interface TenantBrand {
  /** Display name of the company */
  name: string
  /** Short slug for file paths and identifiers */
  slug: string
  /** Path to logo (relative to /public) */
  logo: string
  /** Path to favicon (relative to /public) */
  favicon?: string
  /** Primary brand color (hex) */
  primaryColor: string
  /** Accent/secondary brand color (hex) */
  accentColor: string
  /** Optional partner/powered-by text */
  partnerName?: string
  /** Optional partner logo path */
  partnerLogo?: string
}

export interface TenantConfig {
  brand: TenantBrand
  /** Enabled add-on modules (core modules are always active) */
  modules: ModuleId[]
  /**
   * Feature flags for capabilities inside core modules (EPIC-30 D3b).
   *
   * These toggle UI exposure / navigation entries and route gates ONLY —
   * never permission. The real authorization trava is the E2 RLS/guard;
   * enabling a flag here grants no data access, disabling it just hides the
   * UI. Defaults to false (omit) when not declared.
   */
  features?: {
    /**
     * Org-chart (`reports_to` tree) navigation entry + route gate of the
     * `admin` core module. UI exposure only — gated by E2 RLS at the data layer.
     */
    orgTree?: boolean
  }
  /** Platform behavior overrides */
  settings?: {
    /** Max AI interactions per session (default: 10) */
    maxInteractionsPerSession?: number
    /** AI model override */
    aiModel?: string
    /** Session timeout in hours (default: 24) */
    sessionTimeoutHours?: number
    /** Custom footer text */
    footerText?: string
    /** Support email */
    supportEmail?: string
    /** Custom CSS (sanitized at runtime) */
    customCSS?: string
  }
}
