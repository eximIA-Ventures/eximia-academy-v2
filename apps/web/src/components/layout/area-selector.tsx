"use client"

import { switchArea, exitAreaContext } from "@/app/(platform)/area/actions"
import { useArea } from "@/components/providers/area-provider"
import { useTransition } from "react"

export function AreaSelector() {
  const { activeArea, userAreas } = useArea()
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
    })
  }

  return (
    <div className={`flex items-center gap-1 rounded-full bg-bg-elevated/80 backdrop-blur-sm p-1 shadow-[0_1px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
          !activeArea
            ? "bg-cerrado-600 text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
            : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
        }`}
      >
        Empresa
      </button>
      {userAreas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => handleSelect(area.id)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeArea?.id === area.id
              ? "bg-cerrado-600 text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
        >
          {area.name}
        </button>
      ))}
    </div>
  )
}
