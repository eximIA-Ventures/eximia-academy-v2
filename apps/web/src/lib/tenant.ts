// @ts-expect-error — tenant.config.ts is at app root, resolved via relative path
import tenantConfig from "../../../tenant.config"
import type { TenantConfig } from "@eximia/shared"

/**
 * Returns the static tenant configuration for this deployment.
 * Replaces the old dynamic tenant resolution from Supabase.
 */
export function getTenantConfig(): TenantConfig {
  return tenantConfig
}
