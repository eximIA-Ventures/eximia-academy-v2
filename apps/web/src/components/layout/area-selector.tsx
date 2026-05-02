"use client"

import { switchArea } from "@/app/(platform)/area/actions"
import { useArea } from "@/components/providers/area-provider"
import { Select } from "@eximia/ui"
import { useTransition } from "react"

export function AreaSelector() {
  const { activeArea, userAreas } = useArea()
  const [isPending, startTransition] = useTransition()

  // Only show if user has more than 1 area
  if (userAreas.length <= 1) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const areaId = e.target.value
    if (areaId === activeArea?.id) return
    startTransition(async () => {
      await switchArea(areaId)
    })
  }

  return (
    <Select
      selectSize="sm"
      value={activeArea?.id ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="max-w-[180px]"
      aria-label="Selecionar unidade"
    >
      {userAreas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.name}
        </option>
      ))}
    </Select>
  )
}
