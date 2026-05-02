"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eximia/ui"
import { GraduationCap, MoreVertical, Settings2 } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"
import { InstructorPermissionsForm } from "./instructor-permissions-form"
import { RoleSelector } from "./role-selector"

/* --------------------------------- Types --------------------------------- */

export interface AdminUser {
  id: string
  full_name: string | null
  email: string
  role: string
  status: string
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
}

interface UserListProps {
  initialData: AdminUser[]
  initialCursor: string | null
  currentUserId: string
  search?: string
  roleFilter?: string
  areaFilter?: string
}

/* -------------------------------- Helpers -------------------------------- */

function statusBadgeVariant(status: string) {
  return status === "active" ? ("success" as const) : ("error" as const)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/* ------------------------------- Component ------------------------------- */

export function UserList({
  initialData,
  initialCursor,
  currentUserId,
  search,
  roleFilter,
  areaFilter,
}: UserListProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialData)
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Sync with server-provided data when search/filter changes
  // (parent will re-render with new initialData)
  const [prevSearch, setPrevSearch] = useState(search)
  const [prevRole, setPrevRole] = useState(roleFilter)
  const [prevArea, setPrevArea] = useState(areaFilter)
  if (search !== prevSearch || roleFilter !== prevRole || areaFilter !== prevArea) {
    setUsers(initialData)
    setNextCursor(initialCursor)
    setPrevSearch(search)
    setPrevRole(roleFilter)
    setPrevArea(areaFilter)
  }

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "20" })
      if (roleFilter) params.set("role", roleFilter)
      if (search) params.set("search", search)
      if (areaFilter) params.set("area_id", areaFilter)

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) throw new Error("Erro ao carregar usuários")

      const json = await res.json()
      setUsers((prev) => [...prev, ...json.data])
      setNextCursor(json.nextCursor)
    } catch {
      setLoadError("Erro ao carregar mais usuários. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [nextCursor, loading, roleFilter, search, areaFilter])

  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedInstructorId, setExpandedInstructorId] = useState<string | null>(null)
  const [instructorPerms, setInstructorPerms] = useState<{
    can_create_courses: boolean
    can_create_quizzes: boolean
    can_manage_trails: boolean
    can_view_analytics: boolean
    can_manage_enrollments: boolean
    assigned_area_ids: string[]
  } | null>(null)
  const [permsLoading, setPermsLoading] = useState(false)

  useEffect(() => {
    if (!expandedInstructorId) {
      setInstructorPerms(null)
      return
    }
    setPermsLoading(true)
    fetch(`/api/admin/users/${expandedInstructorId}/instructor-permissions`)
      .then((res) => res.json())
      .then((json) => setInstructorPerms(json.data ?? null))
      .catch(() => setInstructorPerms(null))
      .finally(() => setPermsLoading(false))
  }, [expandedInstructorId])

  const handleRoleChanged = useCallback((userId: string, newRole: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
    if (newRole === "instructor") {
      setExpandedInstructorId(userId)
    } else {
      setExpandedInstructorId((prev) => (prev === userId ? null : prev))
    }
  }, [])

  const handleToggleStatus = useCallback(async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active"
    const actionLabel = newStatus === "inactive" ? "desativar" : "reativar"

    if (!window.confirm(`Tem certeza que deseja ${actionLabel} este usuário?`)) return

    setActionError(null)
    try {
      if (newStatus === "inactive") {
        const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? "Erro ao desativar usuário")
        }
      } else {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? "Erro ao reativar usuário")
        }
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      setActionError(message)
    }
  }, [])

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
          {actionError}
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ultimo Login</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-text-muted">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => {
                const isOwnUser = user.id === currentUserId
                const isExpanded = expandedInstructorId === user.id
                return (
                  <React.Fragment key={user.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {user.full_name ?? "—"}
                          {user.role === "instructor" && (
                            <Badge variant="info" badgeSize="sm" className="gap-1">
                              <GraduationCap size={12} />
                              Instrutor
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-text-secondary">{user.email}</TableCell>
                      <TableCell>
                        <RoleSelector
                          userId={user.id}
                          currentRole={user.role}
                          currentUserIsAdmin
                          isOwnUser={isOwnUser}
                          onRoleChanged={handleRoleChanged}
                          onError={setActionError}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(user.status)} badgeSize="sm">
                          {user.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {formatDate(user.last_sign_in_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <button
                              type="button"
                              aria-label="Acoes do usuário"
                              className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="right-0 left-auto">
                            {user.role === "instructor" && (
                              <DropdownMenuItem
                                onClick={() => setExpandedInstructorId(isExpanded ? null : user.id)}
                              >
                                <Settings2 size={14} className="mr-2" />
                                {isExpanded ? "Fechar Permissoes" : "Gerenciar Permissoes"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(user.id, user.status)}
                              disabled={isOwnUser}
                            >
                              {user.status === "active" ? "Desativar" : "Reativar"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && user.role === "instructor" && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-bg-surface/50 p-4">
                          {permsLoading ? (
                            <p className="text-sm text-text-muted">Carregando permissões...</p>
                          ) : (
                            <InstructorPermissionsForm
                              userId={user.id}
                              initialPermissions={instructorPerms ?? undefined}
                              onSaved={() => setExpandedInstructorId(null)}
                              onError={setActionError}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {loadError && <p className="text-center text-sm text-semantic-error">{loadError}</p>}

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  )
}
