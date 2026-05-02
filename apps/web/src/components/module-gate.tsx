"use client"

import type { ModuleId } from "@eximia/shared"
import { useModules } from "@/components/providers/module-provider"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

interface ModuleGateProps {
  /** Required module for this content to render */
  module: ModuleId
  children: ReactNode
  /** What to show when module is disabled. Default: trigger 404 */
  fallback?: "404" | "hidden" | ReactNode
}

/**
 * Conditionally renders children based on whether a module is enabled.
 *
 * Usage:
 * ```tsx
 * <ModuleGate module="assessments">
 *   <AssessmentsPage />
 * </ModuleGate>
 * ```
 */
export function ModuleGate({ module, children, fallback = "404" }: ModuleGateProps) {
  const { isEnabled } = useModules()

  if (isEnabled(module)) {
    return <>{children}</>
  }

  if (fallback === "404") {
    notFound()
  }

  if (fallback === "hidden") {
    return null
  }

  return <>{fallback}</>
}
