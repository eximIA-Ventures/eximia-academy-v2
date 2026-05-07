"use client"

import { Badge, Card, CardContent } from "@eximia/ui"
import { X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface Area {
  id: string
  name: string
}

interface AreaAssignmentProps {
  selectedAreaIds: string[]
  onChange: (areaIds: string[]) => void
}

export function AreaAssignment({ selectedAreaIds, onChange }: AreaAssignmentProps) {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAreas() {
      try {
        const res = await fetch("/api/admin/areas")
        if (res.ok) {
          const json = await res.json()
          setAreas(json.data ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAreas()
  }, [])

  const handleAdd = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const areaId = e.target.value
      if (!areaId || selectedAreaIds.includes(areaId)) return
      onChange([...selectedAreaIds, areaId])
      e.target.value = ""
    },
    [selectedAreaIds, onChange],
  )

  const handleRemove = useCallback(
    (areaId: string) => {
      onChange(selectedAreaIds.filter((id) => id !== areaId))
    },
    [selectedAreaIds, onChange],
  )

  const availableAreas = areas.filter((a) => !selectedAreaIds.includes(a.id))
  const selectedAreas = areas.filter((a) => selectedAreaIds.includes(a.id))

  if (loading) {
    return <p className="text-sm text-text-muted">Carregando areas...</p>
  }

  if (areas.length === 0) {
    return <p className="text-sm text-text-muted">Nenhuma área cadastrada neste tenant.</p>
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium text-text-primary">Areas Atribuidas</p>
        <p className="text-xs text-text-muted">
          Se nenhuma área for selecionada, o instrutor tera acesso a todos os cursos.
        </p>

        {selectedAreas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedAreas.map((area) => (
              <Badge key={area.id} variant="info" badgeSize="sm" className="gap-1">
                {area.name}
                <button
                  type="button"
                  onClick={() => handleRemove(area.id)}
                  className="ml-1 rounded-full hover:bg-bg-surface"
                  aria-label={`Remover ${area.name}`}
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {availableAreas.length > 0 && (
          <select
            className="w-full rounded-md shadow-card bg-bg-card px-3 py-2 text-sm text-text-primary"
            onChange={handleAdd}
            defaultValue=""
          >
            <option value="" disabled>
              Adicionar area...
            </option>
            {availableAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        )}
      </CardContent>
    </Card>
  )
}
