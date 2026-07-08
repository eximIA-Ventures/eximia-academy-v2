"use client"

import type { TeamViewMode } from "@/lib/team-view-context"
import type { JSX } from "react"
import { type BreadcrumbNode, OrgDrilldownBreadcrumb } from "./org-drilldown-breadcrumb"
import { TeamFilterDropdown, type TeamFilterOption } from "./team-filter-dropdown"
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
  /**
   * Onda 2 (S6): opções do filtro de time elevado ao recorte. Só passado pelo
   * caller quando `isRoot` (os ids do universo só coincidem com as rows na
   * raiz, ver getStudentSubteamMap). Renderiza só em mode "hierarchy".
   */
  teamFilterOptions?: TeamFilterOption[]
  /**
   * Nº de alunos do recorte ativo (Hugo 2026-07-07: o card "Alunos analisados"
   * saiu do grid de triagem e virou esta linha compacta no topo, que também
   * substitui o subtítulo verboso, menos texto no header).
   */
  analyzedCount?: number
}

export function TeamScopeControl({
  trail,
  rootId,
  rootLabel = "Meu Time",
  mode,
  isRoot,
  focusedLabel,
  teamFilterOptions,
  analyzedCount,
}: TeamScopeControlProps): JSX.Element {
  // Resumo dinâmico só quando agrega informação além das pills: num drill-down
  // (!isRoot) ele diz DE QUEM é o recorte. Na raiz, a pill ativa já conta a
  // história e a linha extra só pesava o header (feedback Hugo, 2026-07-07).
  const drillSummary = isRoot
    ? null
    : mode === "hierarchy"
      ? `Diretos de ${focusedLabel} em destaque. Abaixo, todos os alunos dessa estrutura, por time.`
      : `Você está vendo os colaboradores diretos de ${focusedLabel}.`

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Recorte da equipe
        </p>
        <div className="mt-1 flex items-center gap-2.5">
          <h3 className="text-lg font-bold text-text-primary">Quem estou analisando?</h3>
          {typeof analyzedCount === "number" && (
            <span
              style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
              className="inline-flex shrink-0 items-center rounded-full px-3.5 py-1 text-sm font-bold tabular-nums"
              title={`${analyzedCount} ${analyzedCount === 1 ? "aluno" : "alunos"} neste recorte`}
            >
              {analyzedCount} {analyzedCount === 1 ? "aluno" : "alunos"}
            </span>
          )}
        </div>
        {drillSummary && <p className="mt-0.5 text-xs text-text-muted">{drillSummary}</p>}
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <OrgDrilldownBreadcrumb trail={trail} rootId={rootId} rootLabel={rootLabel} />
        <div className="flex items-center gap-2">
          {mode === "hierarchy" && teamFilterOptions && (
            <TeamFilterDropdown options={teamFilterOptions} />
          )}
          <TeamViewSwitch mode={mode} />
        </div>
      </div>
    </div>
  )
}
