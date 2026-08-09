"use client"

// =============================================================================
// OrgDrilldownBreadcrumb — the "subir" affordance of the E9 drill-down.
// =============================================================================
//
// Renders the trail from the manager's own root down to the focused node
// (e.g. "Meu Time › Rafael › Bia"). Every segment is a link that sets the
// `focus` search param to that node (clearing it on the root), so the SSR page
// re-resolves the aggregate at that level. The trail comes from the server,
// already constrained to `auth_subtree_user_ids()` — this component never
// fabricates a node. State lives in the URL: shareable, SSR-friendly, and
// re-validated server-side on every render (the gate is the trava, not this UI).
// =============================================================================

import { ChevronRight, Home } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export interface BreadcrumbNode {
  id: string
  fullName: string
}

interface OrgDrilldownBreadcrumbProps {
  /** Trail root→focus. Index 0 is the manager's own root; last is the focus. */
  trail: BreadcrumbNode[]
  /** The manager's own user id (root) — focusing it clears the `focus` param. */
  rootId: string
  /** Label shown for the root segment (e.g. "Meu Time"). */
  rootLabel?: string
}

export function OrgDrilldownBreadcrumb({
  trail,
  rootId,
  rootLabel = "Meu Time",
}: OrgDrilldownBreadcrumbProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateTo = useCallback(
    (nodeId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nodeId === rootId) {
        params.delete("focus") // back to the whole subtree
      } else {
        params.set("focus", nodeId)
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, rootId],
  )

  // Single level (focus == root) → there is nowhere to go "up". Still render the
  // root chip so the user has a stable anchor and the layout doesn't jump.
  const lastIndex = trail.length - 1

  return (
    <nav aria-label="Navegação da estrutura" className="flex flex-wrap items-center gap-1 text-sm">
      {trail.map((node, i) => {
        const isLast = i === lastIndex
        const isRoot = i === 0
        const label = isRoot ? rootLabel : node.fullName || "—"
        return (
          <div key={node.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-text-muted" aria-hidden />}
            {isLast ? (
              <span className="flex items-center gap-1.5 rounded-md bg-cerrado-600/15 px-2.5 py-1 font-semibold text-cerrado-600">
                {isRoot && <Home size={13} aria-hidden />}
                {label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo(node.id)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
              >
                {isRoot && <Home size={13} aria-hidden />}
                {label}
              </button>
            )}
          </div>
        )
      })}
    </nav>
  )
}
