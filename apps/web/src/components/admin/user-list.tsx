"use client"

import { governanceTitle } from "@/app/(platform)/admin/users/governance"
import {
  USER_DISPLAY_STATUS_LABEL,
  USER_DISPLAY_STATUS_VARIANT,
  deriveUserDisplayStatus,
  isPendingInvite,
} from "@/lib/invites/status"
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eximia/ui"
import {
  GraduationCap,
  IdCard,
  KeyRound,
  MailX,
  MapPin,
  MoreVertical,
  ScrollText,
  Send,
  Settings2,
} from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"
import { InstructorPermissionsForm } from "./instructor-permissions-form"
import { RoleSelector } from "./role-selector"
import { moveUserArea } from "./user-area-move"
import { initialsOf } from "./user-initials"
import {
  type AreaOption,
  type JobRoleOption,
  type ProfileSavedChanges,
  UserProfileDrawer,
} from "./user-profile-drawer"

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
  reports_to: string | null
  job_role_id: string | null
  superior_name?: string | null
  /**
   * Fatos do Supabase Auth (CFG-2.2). Ausentes quando o Auth não respondeu — e
   * aí a pílula volta sozinha ao par binário Ativo/Inativo (AC9).
   */
  invited_at?: string | null
  confirmed_at?: string | null
  /** Nome do cargo já resolvido pelo servidor (CFG-6.1, AC2). */
  job_role_name?: string | null
  /** Nomes das áreas da pessoa (CFG-6.1, AC2). */
  area_names?: string[]
  /** Ids das mesmas áreas — o "Mover de área" precisa deles (CFG-6.1, AC6). */
  area_ids?: string[]
}

interface UserListProps {
  initialData: AdminUser[]
  initialCursor: string | null
  currentUserId: string
  search?: string
  roleFilter?: string
  areaFilter?: string
  statusFilter?: string | null
  jobRoles?: JobRoleOption[]
  areas?: AreaOption[]
  /**
   * A leitura da lista falhou no servidor. A tabela então NÃO pode afirmar
   * "Nenhum usuário encontrado": vazio por falha e vazio por ausência são coisas
   * diferentes, e confundi-las foi o defeito de 2026-07-28.
   */
  listFailed?: boolean
}

/* -------------------------------- Helpers -------------------------------- */

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
  statusFilter,
  jobRoles = [],
  areas = [],
  listFailed = false,
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
  const [prevStatus, setPrevStatus] = useState(statusFilter)
  if (
    search !== prevSearch ||
    roleFilter !== prevRole ||
    areaFilter !== prevArea ||
    statusFilter !== prevStatus
  ) {
    setUsers(initialData)
    setNextCursor(initialCursor)
    setPrevSearch(search)
    setPrevRole(roleFilter)
    setPrevArea(areaFilter)
    setPrevStatus(statusFilter)
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
      if (statusFilter) params.set("status", statusFilter)

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
  }, [nextCursor, loading, roleFilter, search, areaFilter, statusFilter])

  const [actionError, setActionError] = useState<string | null>(null)
  /** Aviso verde de uma ação bem-sucedida (convite reenviado, pessoa movida). */
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null)
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

  // Desativar exige confirmação em sheet (AC4); reativar não é destrutivo e
  // acontece direto — pedir confirmação para desfazer um erro é fricção sem
  // proteção nenhuma.
  const [pendingDeactivation, setPendingDeactivation] = useState<AdminUser | null>(null)

  const handleToggleStatus = useCallback(async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active"

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

  /** Desativar pede confirmação; reativar segue direto. */
  const requestToggleStatus = useCallback(
    (user: AdminUser) => {
      if (user.status === "active") {
        setPendingDeactivation(user)
        return
      }
      void handleToggleStatus(user.id, user.status)
    },
    [handleToggleStatus],
  )

  // ---- Mover de área pelo lado da pessoa (AC6) ----------------------------
  const [moveTarget, setMoveTarget] = useState<AdminUser | null>(null)
  const [moveAreaId, setMoveAreaId] = useState("")
  const [moving, setMoving] = useState(false)

  const openMoveArea = useCallback((user: AdminUser) => {
    setMoveTarget(user)
    setMoveAreaId(user.area_ids?.[0] ?? "")
  }, [])

  const handleConfirmMove = useCallback(async () => {
    if (!moveTarget) return
    setActionError(null)
    setMoving(true)
    const result = await moveUserArea({
      userId: moveTarget.id,
      currentAreaIds: moveTarget.area_ids ?? [],
      targetAreaId: moveAreaId || null,
    })
    setMoving(false)

    if (!result.ok) {
      setActionError(result.message)
      return
    }

    const areaName = areas.find((a) => a.id === moveAreaId)?.name ?? null
    setUsers((prev) =>
      prev.map((u) =>
        u.id === moveTarget.id
          ? {
              ...u,
              area_ids: moveAreaId ? [moveAreaId] : [],
              area_names: areaName ? [areaName] : [],
            }
          : u,
      ),
    )
    setInviteNotice(
      areaName
        ? `${moveTarget.full_name ?? moveTarget.email} agora está em ${areaName}.`
        : `${moveTarget.full_name ?? moveTarget.email} não está mais vinculado a nenhuma área.`,
    )
    setMoveTarget(null)
  }, [moveTarget, moveAreaId, areas])

  // ---- Ciclo de vida do convite (CFG-2.2, AC4/AC5) ------------------------
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null)

  const handleResendInvite = useCallback(async (user: AdminUser) => {
    setActionError(null)
    setInviteNotice(null)
    setInviteBusyId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/resend-invite`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erro ao reenviar convite")
      setInviteNotice(`Convite reenviado para ${user.email}.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setInviteBusyId(null)
    }
  }, [])

  const handleRevokeInvite = useCallback(async (user: AdminUser) => {
    // Confirmação explícita: é a única ação da tela que apaga alguém de verdade.
    if (
      !window.confirm(
        `Revogar o convite de ${user.email}? A conta é apagada e o link enviado deixa de funcionar.`,
      )
    ) {
      return
    }

    setActionError(null)
    setInviteNotice(null)
    setInviteBusyId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/revoke-invite`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Erro ao revogar convite")
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setInviteNotice(`Convite de ${user.email} revogado.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setInviteBusyId(null)
    }
  }, [])

  return (
    <div className="space-y-4">
      {inviteNotice && (
        <div className="rounded-md bg-semantic-success/10 px-4 py-3 text-sm text-semantic-success">
          {inviteNotice}
        </div>
      )}
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
                <TableHead>Pessoa</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ultimo Login</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-text-muted">
                    {listFailed
                      ? "A lista não pôde ser carregada — veja o aviso acima."
                      : "Nenhum usuário encontrado."}
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => {
                const isOwnUser = user.id === currentUserId
                const isExpanded = expandedInstructorId === user.id
                // 4 variantes derivadas (AC2/AC3). Sem os fatos do Auth, cai
                // sozinho no par binário de antes.
                const displayStatus = deriveUserDisplayStatus(user)
                const pendingInvite = isPendingInvite(displayStatus)
                const isInactive = user.status !== "active"
                const attentionTitle = governanceTitle(user)
                return (
                  <React.Fragment key={user.id}>
                    <TableRow>
                      {/* Pessoa: avatar + nome + email numa célula só. O avatar é a
                          inicial do nome — não há foto armazenada em produção. */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar
                            size="sm"
                            src={user.avatar_url ?? undefined}
                            fallback={initialsOf(user)}
                            alt=""
                          />
                          <div className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate">{user.full_name ?? "—"}</span>
                              {attentionTitle && (
                                // O sinal só vale se disser POR QUE: o motivo vai no
                                // `title` e também no rótulo acessível.
                                <span
                                  title={attentionTitle}
                                  aria-label={attentionTitle}
                                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-semantic-warning"
                                />
                              )}
                              {user.role === "instructor" && (
                                <Badge variant="info" badgeSize="sm" className="gap-1">
                                  <GraduationCap size={12} />
                                  Instrutor
                                </Badge>
                              )}
                            </span>
                            <span className="block truncate font-normal text-text-secondary text-xs">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      {/* Cargo e Área resolvidos pelo servidor (AC2): `job_role_id`
                          já vinha na linha desde CFG-0.1 e nunca virava nome na
                          tela; `user_areas` só servia de filtro. */}
                      <TableCell className="text-text-secondary">
                        {user.job_role_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {user.area_names && user.area_names.length > 0
                          ? user.area_names.join(", ")
                          : "—"}
                      </TableCell>
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
                        <Badge variant={USER_DISPLAY_STATUS_VARIANT[displayStatus]} badgeSize="sm">
                          {USER_DISPLAY_STATUS_LABEL[displayStatus]}
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
                          {/* AC5 — o menu depende do estado da linha:
                              ATIVO:       Editar ficha · Mover de área · Redefinir senha ·
                                           Ver ações · Desativar
                              DESATIVADO:  Reativar · Editar ficha · Ver ações
                              CONVITE:     Editar ficha · Reenviar · Revogar · Desativar
                              O bloco "desativado" some de propósito: mover de área ou
                              redefinir senha de quem foi desligado é ação sem sentido
                              que só existe para ser clicada por engano. */}
                          <DropdownMenuContent className="right-0 left-auto">
                            {isInactive && (
                              <DropdownMenuItem
                                onClick={() => requestToggleStatus(user)}
                                disabled={isOwnUser}
                              >
                                Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setProfileUser(user)}>
                              <IdCard size={14} className="mr-2" />
                              Editar ficha
                            </DropdownMenuItem>
                            {!isInactive && areas.length > 0 && (
                              <DropdownMenuItem onClick={() => openMoveArea(user)}>
                                <MapPin size={14} className="mr-2" />
                                Mover de área
                              </DropdownMenuItem>
                            )}
                            {!isInactive && (
                              <DropdownMenuItem onClick={() => setProfileUser(user)}>
                                <KeyRound size={14} className="mr-2" />
                                Redefinir senha
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `/admin/audit?user=${user.id}`
                              }}
                            >
                              <ScrollText size={14} className="mr-2" />
                              Ver ações
                            </DropdownMenuItem>
                            {user.role === "instructor" && (
                              <DropdownMenuItem
                                onClick={() => setExpandedInstructorId(isExpanded ? null : user.id)}
                              >
                                <Settings2 size={14} className="mr-2" />
                                {isExpanded ? "Fechar Permissoes" : "Gerenciar Permissoes"}
                              </DropdownMenuItem>
                            )}
                            {pendingInvite && (
                              <DropdownMenuItem
                                onClick={() => handleResendInvite(user)}
                                disabled={inviteBusyId === user.id}
                              >
                                <Send size={14} className="mr-2" />
                                Reenviar convite
                              </DropdownMenuItem>
                            )}
                            {pendingInvite && (
                              <DropdownMenuItem
                                onClick={() => handleRevokeInvite(user)}
                                disabled={isOwnUser || inviteBusyId === user.id}
                              >
                                <MailX size={14} className="mr-2" />
                                Revogar convite
                              </DropdownMenuItem>
                            )}
                            {/* Desativar segue operando sobre `users.status`,
                                intocado por esta story (CFG-2.2, AC3). */}
                            {!isInactive && (
                              <DropdownMenuItem
                                onClick={() => requestToggleStatus(user)}
                                disabled={isOwnUser}
                              >
                                Desativar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && user.role === "instructor" && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-bg-surface/50 p-4">
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

      {profileUser && (
        <UserProfileDrawer
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setProfileUser(null)
          }}
          user={profileUser}
          jobRoles={jobRoles}
          areas={areas}
          onSaved={(userId, changes: ProfileSavedChanges) => {
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...changes } : u)))
          }}
          onToggleStatus={(user) => {
            setProfileUser(null)
            requestToggleStatus(user)
          }}
        />
      )}

      {/* Confirmação de desativar (AC4). Sheet, e não `window.confirm`: a
          pergunta precisa dizer o NOME de quem será desativado e o que muda —
          um "Tem certeza?" genérico é o mesmo que não perguntar. */}
      <Sheet
        open={pendingDeactivation !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingDeactivation(null)
        }}
      >
        <SheetOverlay />
        <SheetContent side="bottom" aria-label="Confirmar desativação" className="max-w-none">
          <SheetHeader>
            <SheetTitle>Desativar usuário</SheetTitle>
            <SheetDescription>
              {pendingDeactivation?.full_name ?? pendingDeactivation?.email} perde o acesso
              imediatamente, mas o histórico é preservado. Você pode reativar depois.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => setPendingDeactivation(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const target = pendingDeactivation
                setPendingDeactivation(null)
                if (target) void handleToggleStatus(target.id, target.status)
              }}
            >
              Desativar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Mover de área pelo lado da pessoa (AC6). */}
      <Sheet
        open={moveTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMoveTarget(null)
        }}
      >
        <SheetOverlay />
        <SheetContent side="bottom" aria-label="Mover de área" className="max-w-none">
          <SheetHeader>
            <SheetTitle>Mover de área</SheetTitle>
            <SheetDescription>
              {moveTarget?.full_name ?? moveTarget?.email} sai da área atual (
              {moveTarget?.area_names?.join(", ") || "nenhuma"}) e passa para a escolhida.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-w-sm">
            <Select
              aria-label="Área destino"
              value={moveAreaId}
              onChange={(e) => setMoveAreaId(e.target.value)}
              disabled={moving}
            >
              <option value="">Nenhuma área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moving}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmMove} disabled={moving}>
              {moving ? "Movendo..." : "Mover"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
