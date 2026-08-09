"use client"

import { createContext, useContext } from "react"
import type { ResolvedContext } from "@/lib/context-resolver"

/**
 * Distributes the resolved active context + available contexts to client
 * components (E7 §4.7). Template: `area-provider.tsx`.
 *
 * In E7 the Sidebar/Header do NOT consume this yet (that is E8); E7 only makes
 * the context AVAILABLE. The default value is the safe "Minha Trilha" base.
 */

const DEFAULT: ResolvedContext = {
  active: { type: "personal", id: null, label: "Minha Trilha" },
  available: [{ type: "personal", id: null, label: "Minha Trilha" }],
}

const ContextContext = createContext<ResolvedContext>(DEFAULT)

export function ContextProvider({
  value,
  children,
}: {
  value: ResolvedContext
  children: React.ReactNode
}) {
  return <ContextContext.Provider value={value}>{children}</ContextContext.Provider>
}

export function useActiveContext() {
  return useContext(ContextContext)
}
