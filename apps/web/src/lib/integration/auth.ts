import { createServiceClient } from "@/lib/supabase/service"
import { hashKey } from "./helpers"

interface AuthResult {
  valid: true
  tenantId: string | null
  appName: string
  scopes: string[]
  keyId: string
  platformLevel: boolean
}

interface AuthError {
  valid: false
  error: string
  code: string
  status: number
}

/** Validate x-eximia-api-key header and return key metadata */
export async function validateIntegrationKey(
  request: Request,
): Promise<AuthResult | AuthError> {
  const apiKey = request.headers.get("x-eximia-api-key")

  if (!apiKey) {
    return { valid: false, error: "API key missing", code: "UNAUTHORIZED", status: 401 }
  }

  const keyHash = hashKey(apiKey)
  const supabase = createServiceClient()

  const { data: key, error } = await supabase
    .from("integration_keys")
    .select("id, tenant_id, app_name, scopes, status, expires_at")
    .eq("key_hash", keyHash)
    .single()

  if (error || !key) {
    return { valid: false, error: "Invalid API key", code: "UNAUTHORIZED", status: 401 }
  }

  if (key.status !== "active") {
    return { valid: false, error: "API key revoked", code: "UNAUTHORIZED", status: 401 }
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false, error: "API key expired", code: "UNAUTHORIZED", status: 401 }
  }

  // Platform-level key (no tenant) — super admin access, skip tenant check
  if (!key.tenant_id) {
    await supabase
      .from("integration_keys")
      .update({ last_used: new Date().toISOString() })
      .eq("id", key.id)

    return {
      valid: true,
      tenantId: null,
      appName: key.app_name,
      scopes: key.scopes,
      keyId: key.id,
      platformLevel: true,
    }
  }

  // Tenant-scoped key — check tenant has integration enabled
  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", key.tenant_id)
    .single()

  const settings = (tenant?.settings as Record<string, unknown>) ?? {}
  if (!settings.integration_enabled) {
    return { valid: false, error: "Integration not enabled for this tenant", code: "FORBIDDEN", status: 403 }
  }

  // Update last_used
  await supabase
    .from("integration_keys")
    .update({ last_used: new Date().toISOString() })
    .eq("id", key.id)

  return {
    valid: true,
    tenantId: key.tenant_id,
    appName: key.app_name,
    scopes: key.scopes,
    keyId: key.id,
    platformLevel: false,
  }
}

/** Check if a scope is present */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes("admin") || scopes.includes(required)
}
