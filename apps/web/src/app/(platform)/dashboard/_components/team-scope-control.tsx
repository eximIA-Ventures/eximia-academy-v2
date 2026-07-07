"use client"

import type { TeamViewMode } from "@/lib/team-view-context"
import type { JSX } from "react"
import { type BreadcrumbNode, OrgDrilldownBreadcrumb } from "./org-drilldown-breadcrumb"
import { TeamViewSwitch } from "./team-view-switch"

export interface TeamScopeControlProps {
  /** Trail root to focus, already resolved and gated server-side. */
  trail: BreadcrumbNode[]
  /** Manager id, the root of the subtree. Focusing it clears ?focus. */
  rootId: string
  /** Root label, default "Meu Time". */
  rootLabel?: string
  /** Diretos | Hierarquia, current x-team-view cookie state. */
  mode: TeamViewMode
  /** Whether the current focus is the root node. */
  isRoot: boolean
  /** Focused node label, used in the summary when isRoot is false. */
  focusedLabel: string
}

export function TeamScopeControl({
  trail,
  rootId,
  rootLabel = "Meu Time",
  mode,
  isRoot,
  focusedLabel,
}: TeamScopeControlProps): JSX.Element {
  const summary =
    mode === "hierarchy"
      ? isRoot
        ? "Seus diretos em destaque. Abaixo, todos os alunos da sua estrutura, por time."
        : `Diretos de ${focusedLabel} em destaque. Abaixo, todos os alunos dessa estrutura, por time.`
      : isRoot
        ? "Você está vendo seus colaboradores diretos."
        : `Você está vendo os colaboradores diretos de ${focusedLabel}.`

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Recorte da equipe
        </p>
        <p className="mt-1 text-sm text-text-secondary">{summary}</p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <OrgDrilldownBreadcrumb trail={trail} rootId={rootId} rootLabel={rootLabel} />
        <TeamViewSwitch mode={mode} />
      </div>
    </div>
  )
}
