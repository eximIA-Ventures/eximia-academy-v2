"use client"

import { type ModuleId, getEnabledModules, isRouteAllowed } from "@eximia/shared"
import { createContext, useContext, useMemo } from "react"

interface ModuleContextValue {
  /** All enabled module IDs (core + add-ons) */
  enabledIds: ModuleId[]
  /** Check if a specific module is enabled */
  isEnabled: (id: ModuleId) => boolean
  /** Check if a route path is allowed */
  isRouteAllowed: (pathname: string) => boolean
}

const ModuleContext = createContext<ModuleContextValue | null>(null)

export function ModuleProvider({
  modules,
  children,
}: {
  /**
   * Módulos contratados pela empresa — `getTenantConfig().modules`.
   *
   * Vem de `tenants.modules`; quando a coluna está vazia (é o default do
   * banco e ela não foi backfillada), a config já caiu no env legado e,
   * na ausência dele, no NEUTRO — a queda acontece em `lib/tenant/marca.ts`,
   * não aqui, para haver UM lugar que decide o que a empresa tem.
   *
   * Módulo é EXPOSIÇÃO DE UI, nunca permissão (`AGENTS.md`).
   */
  modules: ModuleId[]
  children: React.ReactNode
}) {
  const value = useMemo(() => {
    const enabled = getEnabledModules(modules)
    const enabledIds = enabled.map((m) => m.id)
    const enabledSet = new Set(enabledIds)

    return {
      enabledIds,
      isEnabled: (id: ModuleId) => enabledSet.has(id),
      isRouteAllowed: (pathname: string) => isRouteAllowed(modules, pathname),
    }
  }, [modules])

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
}

export function useModules(): ModuleContextValue {
  const ctx = useContext(ModuleContext)
  if (!ctx) throw new Error("useModules must be used within ModuleProvider")
  return ctx
}
