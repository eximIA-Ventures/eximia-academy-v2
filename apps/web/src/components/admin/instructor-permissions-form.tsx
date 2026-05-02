"use client"

import { Button, Card, CardContent, Checkbox } from "@eximia/ui"
import { useCallback, useState } from "react"
import { AreaAssignment } from "./area-assignment"

interface InstructorPermissionsFormProps {
  userId: string
  initialPermissions?: {
    can_create_courses: boolean
    can_create_quizzes: boolean
    can_manage_trails: boolean
    can_view_analytics: boolean
    can_manage_enrollments: boolean
    assigned_area_ids: string[]
  }
  onSaved?: () => void
  onError?: (message: string) => void
}

const PERMISSION_FIELDS = [
  { key: "can_create_courses", label: "Criar cursos", defaultValue: true },
  { key: "can_create_quizzes", label: "Criar quizzes", defaultValue: true },
  { key: "can_manage_trails", label: "Gerenciar trilhas", defaultValue: false },
  { key: "can_view_analytics", label: "Ver analytics", defaultValue: true },
  { key: "can_manage_enrollments", label: "Gerenciar enrollments", defaultValue: true },
] as const

type PermissionKey = (typeof PERMISSION_FIELDS)[number]["key"]

export function InstructorPermissionsForm({
  userId,
  initialPermissions,
  onSaved,
  onError,
}: InstructorPermissionsFormProps) {
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(() => {
    if (initialPermissions) {
      return {
        can_create_courses: initialPermissions.can_create_courses,
        can_create_quizzes: initialPermissions.can_create_quizzes,
        can_manage_trails: initialPermissions.can_manage_trails,
        can_view_analytics: initialPermissions.can_view_analytics,
        can_manage_enrollments: initialPermissions.can_manage_enrollments,
      }
    }
    return Object.fromEntries(PERMISSION_FIELDS.map((f) => [f.key, f.defaultValue])) as Record<
      PermissionKey,
      boolean
    >
  })

  const [areaIds, setAreaIds] = useState<string[]>(initialPermissions?.assigned_area_ids ?? [])
  const [saving, setSaving] = useState(false)

  const handleToggle = useCallback((key: PermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/instructor-permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...permissions,
          assigned_area_ids: areaIds,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Erro ao salvar permissões")
      }

      onSaved?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      onError?.(message)
    } finally {
      setSaving(false)
    }
  }, [userId, permissions, areaIds, onSaved, onError])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium text-text-primary">Permissoes do Instrutor</p>
        {PERMISSION_FIELDS.map((field) => (
          <Checkbox
            key={field.key}
            checked={permissions[field.key]}
            onCheckedChange={() => handleToggle(field.key)}
          >
            {field.label}
          </Checkbox>
        ))}
        <AreaAssignment selectedAreaIds={areaIds} onChange={setAreaIds} />
        <Button size="sm" onClick={handleSave} disabled={saving} className="mt-2">
          {saving ? "Salvando..." : "Salvar Permissoes"}
        </Button>
      </CardContent>
    </Card>
  )
}
