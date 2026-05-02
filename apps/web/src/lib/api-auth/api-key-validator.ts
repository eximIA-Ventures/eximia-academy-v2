import { createServiceClient } from "@/lib/supabase/service"

export interface ValidatedApiKey {
  id: string
  tenantId: string
  name: string
  scopes: string[]
  rateLimitRpm: number
  rateLimitRpd: number
  corsOrigins: string[]
}

export async function validateApiKey(rawKey: string): Promise<ValidatedApiKey | null> {
  const keyHash = await hashApiKey(rawKey)
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, tenant_id, name, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, is_active",
    )
    .eq("key_hash", keyHash)
    .single()

  if (error || !data) return null
  if (!data.is_active) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null

  // Update last_used_at async (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then()

  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    scopes: data.scopes ?? [],
    rateLimitRpm: data.rate_limit_rpm ?? 60,
    rateLimitRpd: data.rate_limit_rpd ?? 10000,
    corsOrigins: data.cors_origins ?? [],
  }
}

export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function generateApiKey(): { rawKey: string; prefix: string } {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let random = ""
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  for (const byte of array) {
    random += chars[byte % chars.length]
  }
  const rawKey = `exa_live_${random}`
  const prefix = rawKey.slice(0, 12)
  return { rawKey, prefix }
}
