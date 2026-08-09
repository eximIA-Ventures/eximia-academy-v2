"use client"

// =============================================================================
// TeamFilterDropdown — filtro de time URL-backed (?teams=), compartilhado entre
// o recorte ("Quem estou analisando?", variant "select") e a coluna TIME da
// tabela de alunos (variant "funnel"). Onda 2 (S6, EPIC-MANAGER-UX).
//
// Estado único: o search param `?teams=` (ids separados por vírgula,
// `__direct__` = alunos sem sub-time). Os DOIS pontos de consumo são
// subárvores client distintas sem parent client em comum (o recorte vive num
// slot server `teamRecortePanel`, a tabela noutra), então a URL é o único
// canal possível — o mesmo padrão já usado por `?focus=`
// (org-drilldown-breadcrumb.tsx).
//
// Escrita via `window.history.replaceState` (shallow, sem round-trip RSC): o
// Next.js App Router faz patch da History API globalmente (app-router.js) e
// sincroniza `useSearchParams()` em QUALQUER client component que a leia,
// mesmo fora do componente que disparou a escrita. `router.replace` NÃO é
// usado aqui de propósito — ele dispara um novo request RSC da página inteira
// a cada toggle, e o filtro de time é puramente cosmético sobre rows já
// carregadas (ver AC9/AC11 da spec S6).
// =============================================================================

import { SubteamChip } from "@/components/dashboard/subteam-chip"
import { Check, ChevronDown, ListFilter } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/** Token do param para alunos sem sub-time. Igual ao antigo DIRECT_KEY da tabela. */
export const DIRECT_TEAM_KEY = "__direct__"

export interface TeamFilterOption {
  /** user id do dono do sub-time, ou DIRECT_TEAM_KEY. */
  key: string
  /** path.join(" › ") || name || "Direto". */
  label: string
  /** headcount, quando conhecido. */
  count?: number
  /** undefined => chip "Direto". */
  subteam?: { id: string; name: string; colorIndex?: number; path?: string[] }
}

/** "a,b" -> {a,b}; null/"" -> vazio; ignora tokens vazios; dedup (Set). */
export function parseTeamsParam(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean),
  )
}

/** vazio -> null (remove o param); senão ids ordenados unidos por ",". */
export function serializeTeamsParam(selected: Set<string>): string | null {
  if (selected.size === 0) return null
  return [...selected].sort().join(",")
}

/** Interseção selected ∩ {option.key}; vazia -> Set vazio (= sem filtro). Nunca
 * trava a tabela por causa de um id obsoleto/desconhecido no param. */
export function effectiveTeamSelection(
  selected: Set<string>,
  options: TeamFilterOption[],
): Set<string> {
  if (selected.size === 0) return selected
  const validKeys = new Set(options.map((option) => option.key))
  const effective = new Set<string>()
  for (const key of selected) {
    if (validKeys.has(key)) effective.add(key)
  }
  return effective
}

/** Hook compartilhado: lê/escreve ?teams= (única fonte de verdade). */
export function useTeamFilterParam(): {
  selected: Set<string>
  toggle: (key: string) => void
  clearAll: () => void
} {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = useMemo(() => parseTeamsParam(searchParams.get("teams")), [searchParams])

  const writeSelection = useCallback(
    (next: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString())
      const serialized = serializeTeamsParam(next)
      if (serialized) params.set("teams", serialized)
      else params.delete("teams")
      const qs = params.toString()
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, searchParams],
  )

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      writeSelection(next)
    },
    [selected, writeSelection],
  )

  const clearAll = useCallback(() => writeSelection(new Set()), [writeSelection])

  return { selected, toggle, clearAll }
}

export interface TeamFilterDropdownProps {
  options: TeamFilterOption[]
  /** "select": pill com rótulo (recorte). "funnel": só-ícone (coluna TIME). */
  variant?: "select" | "funnel"
}

export function TeamFilterDropdown({ options, variant = "select" }: TeamFilterDropdownProps) {
  const { selected, toggle, clearAll } = useTeamFilterParam()
  const effective = useMemo(() => effectiveTeamSelection(selected, options), [selected, options])
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(true)
  }, [])

  // `fixed` menu does not follow scroll/resize — close it instead of letting it drift.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [open])

  if (options.length <= 1) return null

  return (
    <>
      {variant === "select" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          aria-label="Filtrar por time"
          title="Filtrar por time"
          className={`inline-flex items-center gap-1.5 rounded-xl bg-bg-surface px-3 py-1.5 text-xs font-medium transition-colors ${
            effective.size > 0 ? "text-cerrado-600" : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <ListFilter size={13} aria-hidden />
          {effective.size > 0
            ? `${effective.size} ${effective.size === 1 ? "time" : "times"}`
            : "Todos os times"}
          <ChevronDown size={12} aria-hidden />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          aria-label="Filtrar por time"
          title="Filtrar por time"
          className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors ${
            effective.size > 0
              ? "text-cerrado-600"
              : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <ListFilter size={13} />
          {effective.size > 0 && (
            <span className="text-[10px] font-bold tabular-nums">{effective.size}</span>
          )}
        </button>
      )}

      {open && menuPos && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              backgroundColor: "var(--color-bg-card, #ffffff)",
            }}
            className="z-50 max-h-80 w-72 overflow-y-auto rounded-xl p-1.5 shadow-elevated ring-1 ring-inset ring-black/[0.08]"
          >
            <button
              type="button"
              onClick={() => {
                clearAll()
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-hover"
            >
              <span className="font-medium">Todos os times</span>
              {effective.size === 0 && <Check size={14} className="shrink-0 text-cerrado-600" />}
            </button>
            <div className="my-1 border-t border-black/[0.06]" />
            {options.map((option) => {
              const checked = selected.has(option.key)
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggle(option.key)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? "border-cerrado-600 bg-cerrado-600 text-white"
                          : "border-black/20 bg-transparent"
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <SubteamChip subteam={option.subteam} />
                  </span>
                  {option.count !== undefined && (
                    <span className="shrink-0 text-xs tabular-nums text-text-muted">
                      {option.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
