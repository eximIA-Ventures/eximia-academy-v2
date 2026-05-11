import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { cache } from "react"

/**
 * Cached auth + profile lookup. React cache() deduplicates across
 * layout and page in the same server render (FIX-05 + FIX-18).
 *
 * Epic 11: super_admin has tenant_id = NULL, so the tenants JOIN
 * returns null gracefully (LEFT JOIN via Supabase FK select).
 */
export const getAuthProfile = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null, error: null, supabase }

  const { data: profile, error } = await supabase
    .from("users")
    .select(
      "full_name, role, tenant_id, onboarding_completed, tenants(id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config)",
    )
    .eq("id", user.id)
    .single()

  return { user, profile, error, supabase }
})

/**
 * Resolve tenant ID for admin/super_admin with null tenant_id.
 * Falls back to cookie "x-sa-active-tenant", then first tenant in DB.
 */
/**
 * Returns a Supabase client that bypasses RLS for admin/super_admin with null tenant_id.
 * For normal users, returns the standard auth-scoped client.
 */
export async function getDbClient() {
  const { profile, supabase } = await getAuthProfile()
  if (profile && !profile.tenant_id) {
    return createServiceClient()
  }
  return supabase
}

export async function resolveTenantId(profileTenantId: string | null): Promise<string | null> {
  if (profileTenantId) return profileTenantId
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get("x-sa-active-tenant")?.value
  if (fromCookie) return fromCookie
  const svc = createServiceClient()
  const { data } = await svc.from("tenants").select("id").limit(1)
  return data?.[0]?.id ?? null
}
