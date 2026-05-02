"use client"

import { usePathname, useRouter } from "next/navigation"
import { useMemo, useCallback } from "react"
import { extractTenantSlug, tenantHref, stripTenantPrefix } from "@/lib/tenant-nav"

/**
 * Hook for tenant-aware navigation in client components.
 * Extracts tenant slug from current pathname and provides utilities.
 */
export function useTenantNav() {
  const pathname = usePathname()
  const router = useRouter()

  const slug = useMemo(() => extractTenantSlug(pathname), [pathname])

  /** Current pathname WITHOUT the tenant prefix */
  const tenantPathname = useMemo(() => stripTenantPrefix(pathname), [pathname])

  /** Build a tenant-prefixed href */
  const href = useCallback(
    (path: string) => tenantHref(slug, path),
    [slug],
  )

  /** Navigate to a tenant-prefixed path */
  const push = useCallback(
    (path: string) => router.push(tenantHref(slug, path)),
    [slug, router],
  )

  /** Replace with a tenant-prefixed path */
  const replace = useCallback(
    (path: string) => router.replace(tenantHref(slug, path)),
    [slug, router],
  )

  return {
    /** Current tenant slug (e.g., "cory-alimentos-rp") or null */
    slug,
    /** Current pathname without tenant prefix (e.g., "/dashboard") */
    tenantPathname,
    /** Build href: href("/dashboard") -> "/{slug}/dashboard" */
    href,
    /** router.push with tenant prefix */
    push,
    /** router.replace with tenant prefix */
    replace,
    /** Refresh current page */
    refresh: router.refresh,
  }
}
