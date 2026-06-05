"use client"

import { exitAreaContext, switchArea } from "@/app/(platform)/area/actions"
import { useArea } from "@/components/providers/area-provider"
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

  return (
    <div className={`flex items-center gap-2 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
        Unidade
      </span>
      <div className="flex items-center gap-0.5 rounded-2xl bg-white dark:bg-bg-card p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]">
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className={`relative rounded-xl px-4 py-2 text-[11px] font-semibold tracking-wide transition-all duration-200 ${
            !activeArea
              ? "bg-cerrado-600 text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-black/[0.03]"
          }`}
        >
          Todas
        </button>
        {userAreas.map((area) => (
          <button
            key={area.id}
            type="button"
            onClick={() => handleSelect(area.id)}
            className={`relative rounded-xl px-4 py-2 text-[11px] font-semibold tracking-wide transition-all duration-200 ${
              activeArea?.id === area.id
                ? "bg-cerrado-600 text-white"
                : "text-text-secondary hover:text-text-primary hover:bg-black/[0.03]"
            }`}
          >
            {area.name}
          </button>
        ))}
      </div>
    </div>
  )
}
