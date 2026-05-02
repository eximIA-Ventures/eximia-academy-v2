"use client"

import type { WhitelabelConfig } from "@eximia/shared"
import { createContext, useContext } from "react"

interface TenantBranding {
  logo_url?: string
  primary_color?: string
  secondary_color?: string
}

interface TenantSettings {
  max_interactions_per_session?: number
  ai_model?: string
  partner_logo_url?: string
  partner_name?: string
  features?: {
    ai_detection?: boolean
    learning_journal?: boolean
    certificates?: boolean
    analytics_dashboard?: boolean
  }
}

interface TenantData {
  id: string
  name: string
  slug: string
  branding: TenantBranding
  settings: TenantSettings
  whitelabel_enabled?: boolean
  whitelabel_config?: WhitelabelConfig
}

const TenantContext = createContext<TenantData | null>(null)

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantData
  children: React.ReactNode
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant must be used within TenantProvider")
  return ctx
}

export type { TenantData, TenantBranding, TenantSettings }
