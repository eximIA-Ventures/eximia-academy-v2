"use client"

import { exitRoleLens, switchRoleLens } from "@/app/(platform)/role-lens/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eximia/ui"
import type { RoleLens } from "@eximia/shared"
import { Check, ChevronDown, RotateCcw, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface RoleLensSwitcherProps {
  active: RoleLens
  eligible: RoleLens[]
}

const ROLE_LENS_LABELS: Record<RoleLens, string> = {
  manager: "Gestor",
  instructor: "Instrutor",
  student: "Aluno",
}

export function RoleLensSwitcher({ active, eligible }: RoleLensSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (eligible.length <= 1) return null

  // The switcher offers only professional lenses; if a stale cookie left the
  // active lens as one not offered here (e.g. legacy "student"), display the
  // first eligible so the label never contradicts the options.
  const displayActive = eligible.includes(active) ? active : eligible[0]

  function handleSelect(lens: RoleLens) {
    startTransition(async () => {
      await switchRoleLens(lens)
      router.refresh()
    })
  }

  function handleExit() {
    startTransition(async () => {
      await exitRoleLens()
      router.refresh()
    })
  }

  const activeLabel = ROLE_LENS_LABELS[displayActive]

  return (
    <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex items-center gap-2 rounded-2xl bg-bg-card px-3 py-2 text-[11px] font-semibold tracking-wide text-text-secondary transition-colors hover:text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]"
            aria-label="Trocar papel"
          >
            <UserRound size={14} className="text-cerrado-500 dark:text-cerrado-400" />
            <span className="truncate max-w-[140px]">Vendo como: {activeLabel}</span>
            <ChevronDown size={14} className="text-text-muted" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="left-0 right-auto w-60">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Vendo como
          </p>
          {eligible.map((lens) => {
            const isActive = lens === displayActive
            return (
              <DropdownMenuItem key={lens} onClick={() => handleSelect(lens)}>
                <span className="flex w-full items-center gap-2">
                  <UserRound
                    size={14}
                    className={`shrink-0 ${isActive ? "text-cerrado-500" : "text-text-muted"}`}
                  />
                  <span className="flex-1 truncate">{ROLE_LENS_LABELS[lens]}</span>
                  {isActive && <Check size={14} className="shrink-0 text-cerrado-500" />}
                </span>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExit}>
            <span className="flex w-full items-center gap-2">
              <RotateCcw size={14} className="shrink-0 text-text-muted" />
              <span className="flex-1 truncate">Padrão</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
