"use client"

// =============================================================================
// AreaSelector — "Unidade" filter (place / scope of the data being viewed)
// =============================================================================
//
// Lets a manager with more than one area scope the screen to a single Unidade
// (or "Todas"). Distinct from the ContextSwitcher, which switches the *role
// lens* (Minha Trilha / Meu Time / Org). To make the two filters read as
// parallel-but-different, this control now mirrors the ContextSwitcher /
// tenant-selector dropdown shape instead of an unbounded segmented bar.
//
// UX ONLY: the filtering logic (switchArea / exitAreaContext + router.refresh)
// is unchanged. Only presentation was reworked.
// =============================================================================

import { exitAreaContext, switchArea } from "@/app/(platform)/area/actions"
import { useArea } from "@/components/providers/area-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { Check, ChevronDown, LayoutGrid, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export function AreaSelector() {
  const { activeArea, userAreas } = useArea()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Only show if user has more than 1 area
  if (userAreas.length <= 1) return null

  function handleSelect(areaId: string | null) {
    startTransition(async () => {
      if (areaId) {
        await switchArea(areaId)
      } else {
        await exitAreaContext()
      }
      // switchArea grava o cookie x-active-area, mas o revalidatePath dentro da
      // action re-renderiza com o cookie do request ATUAL (ainda o antigo). O
      // router.refresh() dispara uma nova request — agora com o cookie novo — e
      // re-renderiza a page (server) com o initialAreaId correto. Mesmo padrão
      // de tenant-selector e view-as-student-toggle.
      router.refresh()
    })
  }

  // "Todas" when no specific area is active. Leading icon reflects the state:
  // grid for the aggregate "Todas", pin for a single Unidade.
  const activeLabel = activeArea?.name ?? "Todas as unidades"
  const TriggerIcon = activeArea ? MapPin : LayoutGrid

  return (
    <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex items-center gap-2 rounded-2xl bg-bg-card px-3 py-2 text-[11px] font-semibold tracking-wide text-text-secondary transition-colors hover:text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]"
            aria-label="Filtrar por unidade"
          >
            <TriggerIcon size={14} className="text-cerrado-500 dark:text-cerrado-400" />
            <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-text-muted font-semibold">
              Unidade
            </span>
            <span className="truncate max-w-[120px]">{activeLabel}</span>
            <ChevronDown size={14} className="text-text-muted" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="left-0 right-auto w-60 max-h-[60vh] overflow-y-auto">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Unidade
          </p>

          {/* "Todas" = aggregate, no area filter */}
          <DropdownMenuItem onClick={() => handleSelect(null)}>
            <span className="flex w-full items-center gap-2">
              <LayoutGrid size={14} className="shrink-0 text-text-muted" />
              <span className="flex-1 truncate">Todas as unidades</span>
              {!activeArea && <Check size={14} className="shrink-0 text-cerrado-500" />}
            </span>
          </DropdownMenuItem>

          {userAreas.map((area) => {
            const isActive = activeArea?.id === area.id
            return (
              <DropdownMenuItem key={area.id} onClick={() => handleSelect(area.id)}>
                <span className="flex w-full items-center gap-2">
                  <MapPin
                    size={14}
                    className={`shrink-0 ${isActive ? "text-cerrado-500" : "text-text-muted"}`}
                  />
                  <span className="flex-1 truncate">{area.name}</span>
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
