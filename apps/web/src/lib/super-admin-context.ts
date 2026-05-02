import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

const SA_TENANT_COOKIE = "x-sa-active-tenant"
const COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getActiveTenantForSuperAdmin(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SA_TENANT_COOKIE)?.value
  if (!raw) return null
  // Validate UUID format to prevent injection via manipulated cookies
  if (!UUID_RE.test(raw)) return null
  return raw
}

export async function setActiveTenant(tenantId: string) {
  if (!UUID_RE.test(tenantId)) return // Reject invalid UUIDs
  const cookieStore = await cookies()
  cookieStore.set(SA_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearActiveTenant() {
  const cookieStore = await cookies()
  cookieStore.delete(SA_TENANT_COOKIE)
}

/**
 * Fetches full tenant data from DB by ID for TenantProvider injection
 * when super_admin is browsing in tenant context (Story 11.4).
 */
export async function getSuperAdminTenantContext(tenantId: string) {
  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config")
    .eq("id", tenantId)
    .single()

  return tenant
}
