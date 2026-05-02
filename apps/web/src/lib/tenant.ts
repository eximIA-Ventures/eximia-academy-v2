import { createServiceClient } from "@/lib/supabase/service"
import { headers } from "next/headers"
import { cache } from "react"

/**
 * Resolves the current tenant for server-side rendering.
 *
 * Resolution order:
 *   1. `x-tenant-slug` header (set by middleware in path-based routing)
 *   2. Subdomain extraction from hostname (legacy / transition fallback)
 *   3. "demo" fallback in development mode
 *
 * Story 11.6: Provides whitelabel data to auth layout and login page.
 */
export const getTenantBySubdomain = cache(async () => {
  const headersList = await headers()

  // 1. Path-based: middleware sets x-tenant-slug header
  let tenantSlug: string | null = headersList.get("x-tenant-slug") ?? null

  // 2. Fallback: subdomain extraction (transition period)
  if (!tenantSlug) {
    const hostname = headersList.get("host") || ""
    const subdomain = hostname.split(".")[0]
    tenantSlug =
      subdomain !== "localhost"
        ? subdomain
        : process.env.NODE_ENV === "development"
          ? "demo"
          : null
  }

  if (!tenantSlug) return null

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config")
    .eq("slug", tenantSlug)
    .single()

  return tenant
})
