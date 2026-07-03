"use client"

// =============================================================================
// SubtreeNodeList — the "descer" affordance ("Times abaixo") of the drill-down.
// =============================================================================
//
// Lists the direct-report MANAGERS under the currently focused node, each with
// the aggregate student count of its own subtree. Clicking a subteam sets the
// `focus` search param to that node, so the SSR page re-resolves the analytics
// filtered to that subtree (via `focusUserId`). The candidate list comes from
// the server, already intersected with `auth_subtree_user_ids()`; the gate runs
// again server-side when the focus is applied (defence in depth — a leaf-manager
// like Bia simply gets an empty list because there is nowhere left to drill).
//
// MINI ENGAGEMENT INDICATOR (Iteração 2, 2026-07-02, Hierarquia mode only):
// each card can optionally show a compact "N/M ativos" + traffic-light dots
// next to the student count, sourced from `engagementByNodeId` (a plain
// server-resolved summary map — see getSubteamEngagementSummaries in
// engagement-helpers.ts). Absent/undefined map or missing entry → the card
// just doesn't render the indicator, same layout as before.
// =============================================================================

import { ChevronRight, Users } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export interface SubteamItem {
  id: string
  fullName: string
  studentCount: number
}

/** Structural mirror of `EngagementSummary` (engagement-helpers.ts) — kept
 * local so this client component doesn't import a server-only module. */
export interface SubteamEngagementSummary {
  accessedCount: number
  devendoCount: number
  inativosCount: number
  teamTotal: number
}

interface SubtreeNodeListProps {
  subteams: SubteamItem[]
  /** nodeId -> engagement summary for that subteam's subtree. Optional. */
  engagementByNodeId?: Map<string, SubteamEngagementSummary>
}

export function SubtreeNodeList({ subteams, engagementByNodeId }: SubtreeNodeListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const drillInto = useCallback(
    (nodeId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("focus", nodeId)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  // Leaf manager (no subordinate managers) → nothing to drill into.
  if (subteams.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
          Times abaixo
        </h2>
        <span className="text-xs text-text-muted">
          {subteams.length} {subteams.length === 1 ? "time" : "times"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subteams.map((team) => {
          const engagement = engagementByNodeId?.get(team.id)
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => drillInto(team.id)}
              className="group flex items-center justify-between rounded-2xl bg-bg-card p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated hover:ring-1 hover:ring-cerrado-600/25"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-varzea/15">
                  <Users size={18} className="text-varzea" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{team.fullName || "—"}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {team.studentCount} {team.studentCount === 1 ? "aluno" : "alunos"}
                  </p>
                  {engagement && engagement.teamTotal > 0 && (
                    <div
                      className="mt-1.5 flex items-center gap-1.5"
                      aria-label={`${engagement.accessedCount} de ${engagement.teamTotal} ativos`}
                    >
                      <span className="flex items-center gap-0.5" aria-hidden="true">
                        <span className="h-1.5 w-1.5 rounded-full bg-semantic-success" />
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-gold" />
                        <span className="h-1.5 w-1.5 rounded-full bg-semantic-error" />
                      </span>
                      <span className="text-[10px] font-medium text-text-muted tabular-nums">
                        {engagement.accessedCount}/{engagement.teamTotal} ativos
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cerrado-600"
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
