/**
 * Tenant-aware navigation utilities for path-based multi-tenant routing.
 *
 * URL pattern: /{tenantSlug}/dashboard, /{tenantSlug}/courses/...
 * Super admin: /super-admin/... (no tenant prefix)
 * API: /api/... (no tenant prefix)
 */

// Paths that should NEVER be prefixed with a tenant slug
const PASSTHROUGH_PREFIXES = [
  "/super-admin",
  "/api",
  "/_next",
  "/logos",
  "/brandbook",
  "/onboarding",
  "/favicon.ico",
]

/**
 * Prefix a path with the tenant slug.
 * tenantHref("cory-rp", "/dashboard") -> "/cory-rp/dashboard"
 * tenantHref("cory-rp", "/") -> "/cory-rp"
 * tenantHref(null, "/dashboard") -> "/dashboard" (fallback, no prefix)
 */
export function tenantHref(slug: string | null | undefined, path: string): string {
  if (!slug) return path
  if (PASSTHROUGH_PREFIXES.some((p) => path.startsWith(p))) return path
  const cleanPath = path === "/" ? "" : path
  return `/${slug}${cleanPath}`
}

/**
 * Strip the tenant slug prefix from a pathname.
 * stripTenantPrefix("/cory-rp/dashboard") -> "/dashboard"
 * stripTenantPrefix("/super-admin/tenants") -> "/super-admin/tenants" (no strip)
 * stripTenantPrefix("/") -> "/"
 */
export function stripTenantPrefix(pathname: string): string {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) return pathname
  // Match /{slug}/rest... where slug is lowercase alphanumeric + hyphens
  const match = pathname.match(/^\/([a-z0-9][a-z0-9-]*)(\/.*)$/)
  if (match) return match[2]
  // Match /{slug} (no trailing path)
  const matchRoot = pathname.match(/^\/([a-z0-9][a-z0-9-]*)$/)
  if (matchRoot) return "/"
  return pathname
}

/**
 * Extract tenant slug from a pathname.
 * extractTenantSlug("/cory-rp/dashboard") -> "cory-rp"
 * extractTenantSlug("/super-admin/tenants") -> null
 * extractTenantSlug("/") -> null
 */
export function extractTenantSlug(pathname: string): string | null {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) return null
  const match = pathname.match(/^\/([a-z0-9][a-z0-9-]*)/)
  return match ? match[1] : null
}

/**
 * Read tenant slug from request headers (set by middleware).
 * For use in server components.
 */
export async function getTenantSlugFromHeaders(): Promise<string | null> {
  const { headers } = await import("next/headers")
  const headersList = await headers()
  return headersList.get("x-tenant-slug") ?? null
}

/**
 * Server-side redirect with tenant prefix.
 * Reads slug from headers and redirects to /{slug}{path}.
 */
export async function tenantRedirect(path: string) {
  const { redirect } = await import("next/navigation")
  const slug = await getTenantSlugFromHeaders()
  return redirect(tenantHref(slug, path))
}

export { PASSTHROUGH_PREFIXES }
