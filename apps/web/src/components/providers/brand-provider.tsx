"use client"

import type { TenantBrand } from "@eximia/shared"
import { createContext, useContext } from "react"

const BrandContext = createContext<TenantBrand | null>(null)

export function BrandProvider({
  brand,
  children,
}: {
  brand: TenantBrand
  children: React.ReactNode
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useBrand(): TenantBrand {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error("useBrand must be used within BrandProvider")
  return ctx
}
