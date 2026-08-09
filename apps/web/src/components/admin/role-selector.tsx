"use client"

import { Badge, Select } from "@eximia/ui"
import { useCallback, useState } from "react"

/* --------------------------------- Types --------------------------------- */

interface RoleSelectorProps {
  userId: string
  currentRole: string
  currentUserIsAdmin: boolean
  isOwnUser: boolean
  onRoleChanged: (userId: string, newRole: string) => void
  onError?: (message: string) => void
}

/* -------------------------------- Helpers -------------------------------- */

const ROLE_LABELS: Record<string, string> = {
  student: "Estudante",
  leader: "Lider Educador",
  manager: "Gestor",
  admin: "Admin",
  instructor: "Instrutor",
}

function roleBadgeVariant(role: string) {
  switch (role) {
    case "admin":
      return "error" as const
    case "manager":
      return "warning" as const
    case "instructor":
      return "info" as const
    case "leader":
      return "success" as const
    default:
      return "default" as const
  }
}

/* ------------------------------- Component ------------------------------- */

export function RoleSelector({
  userId,
  currentRole,
  currentUserIsAdmin,
  isOwnUser,
  onRoleChanged,
  onError,
}: RoleSelectorProps) {
  const [updating, setUpdating] = useState(false)

  // Admin cannot demote themselves
  const disabled = !currentUserIsAdmin || (isOwnUser && currentRole === "admin") || updating

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRole = e.target.value
      if (newRole === currentRole) return

      const label = ROLE_LABELS[newRole] ?? newRole
      if (!window.confirm(`Alterar papel deste usuário para "${label}"?`)) {
        // Reset the select to the current role
        e.target.value = currentRole
        return
      }

      setUpdating(true)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        })

        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? "Erro ao alterar papel")
        }

        onRoleChanged(userId, newRole)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido"
        if (onError) onError(message)
        // Reset select on error
        e.target.value = currentRole
      } finally {
        setUpdating(false)
      }
    },
    [userId, currentRole, onRoleChanged, onError],
  )

  // If user can't change (own admin account), show a static badge
  if (isOwnUser && currentRole === "admin") {
    return (
      <Badge variant={roleBadgeVariant(currentRole)} badgeSize="sm">
        {ROLE_LABELS[currentRole] ?? currentRole}
      </Badge>
    )
  }

  return (
    <Select
      selectSize="sm"
      value={currentRole}
      onChange={handleChange}
      disabled={disabled}
      className="max-w-[140px]"
    >
      <option value="student">Estudante</option>
      <option value="leader">Lider Educador</option>
      <option value="manager">Gestor</option>
      <option value="admin">Admin</option>
      <option value="instructor">Instrutor</option>
    </Select>
  )
}
