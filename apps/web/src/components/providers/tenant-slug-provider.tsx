"use client"

import { createContext, useContext } from "react"

interface TenantSlugContextValue {
  slug: string | null
}

const TenantSlugContext = createContext<TenantSlugContextValue>({ slug: null })

export function TenantSlugProvider({
  slug,
  children,
}: {
  slug: string | null
  children: React.ReactNode
}) {
  return (
    <TenantSlugContext.Provider value={{ slug }}>
      {children}
    </TenantSlugContext.Provider>
  )
}

export function useTenantSlug() {
  return useContext(TenantSlugContext).slug
}

/** Prefix a path with the current tenant slug. Use in client components for navigation. */
export function useTenantHref() {
  const slug = useContext(TenantSlugContext).slug
  return (path: string) => (slug ? `/${slug}${path}` : path)
}
