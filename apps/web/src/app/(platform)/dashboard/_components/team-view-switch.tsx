"use client"

// =============================================================================
// TeamViewSwitch — "Diretos / Hierarquia" toggle (team context only).
// =============================================================================
//
// Applies to the CURRENTLY FOCUSED node (root or a drilled-down subteam, per
// E9's `?focus=` — see manager-team-dashboard-page.tsx). Switching modes never
// changes `focus`; it only decides whether the analytics for that node are
// DIRECT members (Diretos, default — "meu time" primeiro) or the WHOLE
// reachable subtree (Hierarquia — o que está abaixo do meu time). The "Times
// abaixo" drill-down list stays visible in both modes — it is how a manager
// inspects sub-times even while pinned to Diretos at the current node.
//
// SECURITY: purely a UI-hint cookie (x-team-view). It never widens reach —
// see team-view-context.ts and getDirectTeamStudentIds in area-context.ts.
// =============================================================================

import { setTeamView } from "@/app/(platform)/context/actions"
import type { TeamViewMode } from "@/lib/team-view-context"
import { Network, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface TeamViewSwitchProps {
  mode: TeamViewMode
}

// Order matters: "Diretos" first — it is both the default and the first step
// of the mental model ("primeiro o meu time, depois o que está abaixo dele").
const OPTIONS: Array<{ value: TeamViewMode; label: string; icon: typeof Network }> = [
  { value: "direct", label: "Diretos", icon: Users },
  { value: "hierarchy", label: "Hierarquia", icon: Network },
]

export function TeamViewSwitch({ mode }: TeamViewSwitchProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSelect(next: TeamViewMode) {
    if (next === mode) return
    startTransition(async () => {
      await setTeamView(next)
      router.refresh()
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Recorte da equipe: diretos ou hierarquia"
      className={`inline-flex items-center gap-0.5 rounded-xl bg-bg-surface p-1 ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = value === mode
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(value)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-bg-card text-cerrado-600 shadow-card"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon size={13} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
