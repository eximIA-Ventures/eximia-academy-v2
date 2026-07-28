"use client"

import {
  USER_DISPLAY_STATUS_LABEL,
  USER_DISPLAY_STATUS_VARIANT,
  deriveUserDisplayStatus,
} from "@/lib/invites/status"
import {
  Avatar,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  useToast,
} from "@eximia/ui"
import { KeyRound, ScrollText, Search, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { moveUserArea } from "./user-area-move"
import type { AdminUser } from "./user-list"

/**
 * A ficha da pessoa (CFG-6.1, AC4).
 *
 * Era um `Modal` centralizado (CFG-0.1) e vira um DRAWER lateral. A troca não é
 * estética: a ficha agora carrega vínculo organizacional, área e as ações
 * destrutivas, e um modal centralizado esconde a lista atrás dele — o admin
 * perde a referência de onde estava. O drawer mantém a lista visível ao lado.
 *
 * Continua sendo o mesmo `PATCH` de sempre para Superior/Cargo; a Área usa as
 * mutações que a tela de áreas já usa (`user-area-move.ts`), nunca uma rota
 * nova.
 */

/* --------------------------------- Types --------------------------------- */

export interface JobRoleOption {
  id: string
  name: string
}

export interface AreaOption {
  id: string
  name: string
}

interface SuperiorCandidate {
  id: string
  full_name: string | null
  email: string
  status: string
}

export interface ProfileSavedChanges {
  reports_to: string | null
  job_role_id: string | null
  superior_name: string | null
  job_role_name: string | null
  area_ids: string[]
  area_names: string[]
}

interface UserProfileDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUser
  jobRoles: JobRoleOption[]
  areas: AreaOption[]
  onSaved: (userId: string, changes: ProfileSavedChanges) => void
  /** Desativar/Reativar continua operando sobre `users.status` (AC4). */
  onToggleStatus: (user: AdminUser) => void
}

/* ------------------------------- Component ------------------------------- */

function initialsOf(user: AdminUser): string {
  const source = user.full_name?.trim() || user.email
  const parts = source.split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)
  return letters.toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  student: "Estudante",
  leader: "Líder Educador",
  manager: "Gestor",
  admin: "Administrador",
  instructor: "Instrutor",
  super_admin: "Super Admin",
}

export function UserProfileDrawer({
  open,
  onOpenChange,
  user,
  jobRoles,
  areas,
  onSaved,
  onToggleStatus,
}: UserProfileDrawerProps) {
  const { toast } = useToast()

  const [reportsTo, setReportsTo] = useState<string | null>(user.reports_to)
  const [superiorLabel, setSuperiorLabel] = useState<string | null>(user.superior_name ?? null)
  const [jobRoleId, setJobRoleId] = useState<string>(user.job_role_id ?? "")
  const [areaId, setAreaId] = useState<string>(user.area_ids?.[0] ?? "")

  const [superiorSearch, setSuperiorSearch] = useState("")
  const [candidates, setCandidates] = useState<SuperiorCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saving, setSaving] = useState(false)
  const [resetConfirming, setResetConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync form state when the drawer opens for a (possibly different) user
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setReportsTo(user.reports_to)
      setSuperiorLabel(user.superior_name ?? null)
      setJobRoleId(user.job_role_id ?? "")
      setAreaId(user.area_ids?.[0] ?? "")
      setSuperiorSearch("")
      setCandidates([])
      setResetConfirming(false)
      setError(null)
    }
  }

  // Debounced search for active users of the tenant (excludes the user itself)
  const handleSuperiorSearch = useCallback(
    (value: string) => {
      setSuperiorSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!value.trim()) {
        setCandidates([])
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const params = new URLSearchParams({ search: value.trim(), limit: "20" })
          const res = await fetch(`/api/admin/users?${params.toString()}`)
          if (!res.ok) throw new Error("Erro ao buscar usuários")
          const json = await res.json()
          const list: SuperiorCandidate[] = (json.data ?? []).filter(
            (u: SuperiorCandidate) => u.status === "active" && u.id !== user.id,
          )
          setCandidates(list)
        } catch {
          setCandidates([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [user.id],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSelectSuperior = useCallback((candidate: SuperiorCandidate) => {
    setReportsTo(candidate.id)
    setSuperiorLabel(candidate.full_name ?? candidate.email)
    setSuperiorSearch("")
    setCandidates([])
  }, [])

  const handleClearSuperior = useCallback(() => {
    setReportsTo(null)
    setSuperiorLabel(null)
  }, [])

  const handleSave = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportsTo,
          jobRoleId: jobRoleId || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        const msg = typeof json.error === "string" ? json.error : "Erro ao salvar ficha."
        throw new Error(msg)
      }

      // A Área é outra tabela (`user_areas`) e por isso é outra escrita — feita
      // pelas MESMAS rotas da tela de áreas. Vem depois do PATCH de propósito:
      // se ela falhar, o vínculo organizacional já salvo não é perdido, e o erro
      // diz exatamente o que ficou para trás.
      const currentAreaIds = user.area_ids ?? []
      const moved = await moveUserArea({
        userId: user.id,
        currentAreaIds,
        targetAreaId: areaId || null,
      })
      if (!moved.ok) {
        throw new Error(`Ficha salva, mas a área não mudou: ${moved.message}`)
      }

      const areaName = areas.find((a) => a.id === areaId)?.name ?? null
      onSaved(user.id, {
        reports_to: reportsTo,
        job_role_id: jobRoleId || null,
        superior_name: superiorLabel,
        job_role_name: jobRoles.find((jr) => jr.id === jobRoleId)?.name ?? null,
        area_ids: areaId ? [areaId] : [],
        area_names: areaName ? [areaName] : [],
      })
      toast({ variant: "success", title: "Ficha atualizada com sucesso." })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [
    user.id,
    user.area_ids,
    reportsTo,
    jobRoleId,
    areaId,
    superiorLabel,
    areas,
    jobRoles,
    onSaved,
    toast,
    onOpenChange,
  ])

  const handleResetPassword = useCallback(async () => {
    setError(null)
    setResetting(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" })
      if (!res.ok) {
        const json = await res.json()
        const msg = typeof json.error === "string" ? json.error : "Erro ao redefinir senha."
        throw new Error(msg)
      }
      toast({
        variant: "success",
        title: "Email de redefinição enviado",
        description: `Enviamos as instruções de redefinição para ${user.email}.`,
      })
      setResetConfirming(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      toast({ variant: "error", title: "Falha ao redefinir senha", description: message })
    } finally {
      setResetting(false)
    }
  }, [user.id, user.email, toast])

  const displayStatus = deriveUserDisplayStatus(user)
  const isInactive = user.status !== "active"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetOverlay />
      <SheetContent
        side="right"
        aria-label="Ficha do usuário"
        className="flex w-full max-w-md flex-col overflow-y-auto"
      >
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                size="lg"
                src={user.avatar_url ?? undefined}
                fallback={initialsOf(user)}
                alt={user.full_name ?? user.email}
              />
              <div className="min-w-0">
                <SheetTitle className="truncate">{user.full_name ?? "Sem nome"}</SheetTitle>
                <SheetDescription className="truncate">{user.email}</SheetDescription>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="info" badgeSize="sm">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </Badge>
                  <Badge variant={USER_DISPLAY_STATUS_VARIANT[displayStatus]} badgeSize="sm">
                    {USER_DISPLAY_STATUS_LABEL[displayStatus]}
                  </Badge>
                </div>
              </div>
            </div>
            <SheetClose aria-label="Fechar ficha" />
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Superior imediato */}
          <div className="space-y-2">
            <Label htmlFor="profile-superior">Superior imediato</Label>
            {superiorLabel ? (
              <div className="flex items-center justify-between rounded-md border border-border-default bg-bg-surface px-3 py-2 text-sm">
                <span>{superiorLabel}</span>
                <button
                  type="button"
                  aria-label="Limpar superior imediato"
                  onClick={handleClearSuperior}
                  className="text-text-muted transition-colors hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="profile-superior"
                  placeholder="Buscar usuário ativo por nome ou email..."
                  value={superiorSearch}
                  onChange={(e) => handleSuperiorSearch(e.target.value)}
                  leadingIcon={<Search size={16} />}
                  disabled={saving}
                />
                {(candidates.length > 0 || searching) && superiorSearch.trim() && (
                  <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border-default bg-bg-primary shadow-md">
                    {searching && <p className="px-3 py-2 text-sm text-text-muted">Buscando...</p>}
                    {!searching &&
                      candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectSuperior(c)}
                          className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-surface"
                        >
                          <span className="font-medium">{c.full_name ?? "—"}</span>{" "}
                          <span className="text-text-muted">{c.email}</span>
                        </button>
                      ))}
                    {!searching && candidates.length === 0 && (
                      <p className="px-3 py-2 text-sm text-text-muted">
                        Nenhum usuário ativo encontrado.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <Label htmlFor="profile-job-role">Cargo</Label>
            <Select
              id="profile-job-role"
              value={jobRoleId}
              onChange={(e) => setJobRoleId(e.target.value)}
              disabled={saving}
            >
              <option value="">Nenhum</option>
              {jobRoles.map((jr) => (
                <option key={jr.id} value={jr.id}>
                  {jr.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Área */}
          <div className="space-y-2">
            <Label htmlFor="profile-area">Área</Label>
            <Select
              id="profile-area"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              disabled={saving || areas.length === 0}
            >
              <option value="">Nenhuma</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
            {(user.area_names?.length ?? 0) > 1 && (
              <p className="text-xs text-text-muted">
                Esta pessoa está em mais de uma área ({user.area_names?.join(", ")}). Salvar deixa
                só a área escolhida.
              </p>
            )}
          </div>

          {/* Redefinir senha */}
          <div className="space-y-2 rounded-md border border-border-default p-3">
            {resetConfirming ? (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Enviar email de redefinição de senha para{" "}
                  <span className="font-medium text-text-primary">{user.email}</span>?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleResetPassword} disabled={resetting}>
                    {resetting ? "Enviando..." : "Confirmar envio"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetConfirming(false)}
                    disabled={resetting}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResetConfirming(true)}
                disabled={saving}
              >
                <KeyRound size={14} />
                Redefinir senha
              </Button>
            )}
          </div>

          {/* Ponte para auditoria */}
          <a
            href={`/admin/audit?user=${user.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline"
          >
            <ScrollText size={14} />
            Ver ações deste usuário
          </a>

          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <div className="flex flex-col gap-2 border-border-subtle border-t pt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            {/* A ação destrutiva fica separada do salvar, e o texto diz o que
                acontece — não "Excluir", porque não é exclusão: é desativação. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleStatus(user)}
              disabled={saving}
              className={isInactive ? undefined : "text-semantic-error"}
            >
              {isInactive ? "Reativar usuário" : "Desativar usuário"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
