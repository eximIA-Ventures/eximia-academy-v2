"use client"

// =============================================================================
// ContextSwitcher (E8, chokepoint 4) — "Minha Trilha / Meu Time / Minha Org"
// =============================================================================
//
// Lists ONLY the contexts the person may assume (`available`, computed
// server-side in E7 against user_roles). Hidden for a pure student (≤1 option).
// Absorbs the old ViewAsStudentToggle: "Minha Trilha" = personal context.
//
// SECURITY: the client is never the authority. `available` is server-resolved;
// `switchContext` re-validates the requested context against user_roles before
// writing the cookie. Selecting "Minha Trilha" calls `exitContextMode()`
// (clears the elevated cookie) — `personal` is not a cookie form (E7 §4.10).
// =============================================================================

import { exitContextMode, switchContext } from "@/app/(platform)/context/actions"
import type { AvailableContext } from "@/lib/context-resolver"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { Building2, Check, ChevronDown, Eye, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface ContextSwitcherProps {
  active: AvailableContext
  /** Server-resolved (vs user_roles), with label. `<= 1` => not rendered. */
  available: AvailableContext[]
}

const CONTEXT_ICON = {
  personal: Eye,
  team: Users,
  organization: Building2,
} as const

/** Stable key for a context entry (type + id). */
function contextKey(ctx: AvailableContext): string {
  return `${ctx.type}:${ctx.id ?? ""}`
}

export function ContextSwitcher({ active, available }: ContextSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Pure student (or any single-context user): nothing to switch — render nothing.
  if (available.length <= 1) return null

  function handleSelect(ctx: AvailableContext) {
    startTransition(async () => {
      if (ctx.type === "personal") {
        // "Minha Trilha" = exit elevated context (clears x-active-context +
        // x-view-as-student). personal is not a cookie form (E7 §4.10).
        await exitContextMode()
      } else {
        // team/organization: server re-validates against user_roles before
        // writing the cookie; a forged/unauthorized context is denied server-side.
        await switchContext({ type: ctx.type, id: ctx.id })
      }
      // Action writes the cookie without revalidatePath; refresh re-renders the
      // server tree with the NEW cookie (same pattern as area-selector).
      router.refresh()
    })
  }

  const ActiveIcon = CONTEXT_ICON[active.type]

  return (
    <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex items-center gap-2 rounded-2xl bg-bg-card px-3 py-2 text-[11px] font-semibold tracking-wide text-text-secondary transition-colors hover:text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]"
            aria-label="Trocar contexto"
          >
            <ActiveIcon size={14} className="text-cerrado-500 dark:text-cerrado-400" />
            <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-text-muted font-semibold">
              Contexto
            </span>
            <span className="truncate max-w-[120px]">{active.label}</span>
            <ChevronDown size={14} className="text-text-muted" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="left-0 right-auto w-60">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Contexto
          </p>
          {available.map((ctx) => {
            const Icon = CONTEXT_ICON[ctx.type]
            const isActive = ctx.type === active.type && (ctx.id ?? null) === (active.id ?? null)
            return (
              <DropdownMenuItem key={contextKey(ctx)} onClick={() => handleSelect(ctx)}>
                <span className="flex w-full items-center gap-2">
                  <Icon
                    size={14}
                    className={`shrink-0 ${isActive ? "text-cerrado-500" : "text-text-muted"}`}
                  />
                  <span className="flex-1 truncate">{ctx.label}</span>
                  {isActive && <Check size={14} className="shrink-0 text-cerrado-500" />}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
