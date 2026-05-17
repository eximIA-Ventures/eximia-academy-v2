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
    <div className={`relative flex items-center gap-0.5 rounded-full border border-border-subtle bg-bg-card p-[3px] shadow-sm ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
          !activeArea
            ? "bg-cerrado-600 text-white shadow-md"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        Empresa
      </button>
      {userAreas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => handleSelect(area.id)}
          className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
            activeArea?.id === area.id
              ? "bg-cerrado-600 text-white shadow-md"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {area.name}
        </button>
      ))}
    </div>
  )
}
