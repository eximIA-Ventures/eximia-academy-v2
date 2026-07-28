"use client"

import { InviteUserDialog } from "@/components/admin/invite-user-dialog"
import { UserBulkImportDialog } from "@/components/admin/user-bulk-import-dialog"
import { type AdminUser, UserList } from "@/components/admin/user-list"
import type { JobRoleOption } from "@/components/admin/user-profile-drawer"
import { Button, Input, Select } from "@eximia/ui"
import { Search, Upload, UserPlus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { DISPLAY_STATUS_FILTER_LABEL, type DisplayStatusFilter } from "./filters"
import { UserStatsGrid } from "./user-stats-grid"

/* --------------------------------- Types --------------------------------- */

interface AreaOption {
  id: string
  name: string
  slug: string
}

interface UserManagementClientProps {
  initialData: AdminUser[]
  initialCursor: string | null
  currentUserId: string
  initialSearch: string
  initialRoleFilter: string
  areas?: AreaOption[]
  initialAreaFilter?: string
  jobRoles?: JobRoleOption[]
  /** Filtro por estado exibido, vindo do clique num card (AC8). */
  initialStatusFilter?: DisplayStatusFilter | null
  /** `true` quando o filtro pedido não pôde ser honrado (Auth fora do ar). */
  statusFilterUnavailable?: boolean
  /**
   * Contadores do topo. Renderizados AQUI, e não pela página, porque clicar num
   * card é aplicar um filtro — e o dono do estado de filtro é este componente.
   * Com o grid fora dele, o clique mudaria a URL sem mexer nos `<select>` da
   * barra, e a tela mostraria um filtro que os controles não confessam.
   */
  stats?: {
    total: number
    active: number
    admins: number
    pendingInvites: number | null
  } | null
}

/* ------------------------------- Component ------------------------------- */

export function UserManagementClient({
  initialData,
  initialCursor,
  currentUserId,
  initialSearch,
  initialRoleFilter,
  areas = [],
  initialAreaFilter = "",
  jobRoles = [],
  initialStatusFilter = null,
  statusFilterUnavailable = false,
  stats = null,
}: UserManagementClientProps) {
  const router = useRouter()

  const [search, setSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter)
  const [areaFilter, setAreaFilter] = useState(initialAreaFilter)
  const [statusFilter, setStatusFilter] = useState<DisplayStatusFilter | null>(initialStatusFilter)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Navegação (voltar, link colado, clique num card) muda os props sem
  // remontar: sem esta ressincronização os controles ficariam mostrando o
  // filtro anterior enquanto a lista já veio filtrada pelo novo.
  const [prevProps, setPrevProps] = useState({
    initialSearch,
    initialRoleFilter,
    initialAreaFilter,
    initialStatusFilter,
  })
  if (
    prevProps.initialSearch !== initialSearch ||
    prevProps.initialRoleFilter !== initialRoleFilter ||
    prevProps.initialAreaFilter !== initialAreaFilter ||
    prevProps.initialStatusFilter !== initialStatusFilter
  ) {
    setPrevProps({ initialSearch, initialRoleFilter, initialAreaFilter, initialStatusFilter })
    setSearch(initialSearch)
    setRoleFilter(initialRoleFilter)
    setAreaFilter(initialAreaFilter)
    setStatusFilter(initialStatusFilter)
  }

  // Debounced URL update for search
  const updateUrl = useCallback(
    (
      newSearch: string,
      newRole: string,
      newArea: string,
      newStatus: DisplayStatusFilter | null,
    ) => {
      const params = new URLSearchParams()
      if (newSearch) params.set("search", newSearch)
      if (newRole) params.set("role", newRole)
      if (newArea) params.set("area_id", newArea)
      if (newStatus) params.set("status", newStatus)
      const qs = params.toString()
      router.push(qs ? `?${qs}` : "?", { scroll: false })
    },
    [router],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateUrl(value, roleFilter, areaFilter, statusFilter)
      }, 300)
    },
    [roleFilter, areaFilter, statusFilter, updateUrl],
  )

  const handleRoleFilterChange = useCallback(
    (value: string) => {
      setRoleFilter(value)
      updateUrl(search, value, areaFilter, statusFilter)
    },
    [search, areaFilter, statusFilter, updateUrl],
  )

  const handleAreaFilterChange = useCallback(
    (value: string) => {
      setAreaFilter(value)
      updateUrl(search, roleFilter, value, statusFilter)
    },
    [search, roleFilter, statusFilter, updateUrl],
  )

  const handleStatusFilterChange = useCallback(
    (value: DisplayStatusFilter | null) => {
      setStatusFilter(value)
      updateUrl(search, roleFilter, areaFilter, value)
    },
    [search, roleFilter, areaFilter, updateUrl],
  )

  /** Clique no card "Administradores": é papel, não estado — vai no outro eixo. */
  const handleAdminsSelected = useCallback(() => {
    const next = roleFilter === "admin" ? "" : "admin"
    setRoleFilter(next)
    updateUrl(search, next, areaFilter, statusFilter)
  }, [roleFilter, search, areaFilter, statusFilter, updateUrl])

  /** Clique no card "Usuários": limpa tudo e volta à lista inteira. */
  const handleClearAll = useCallback(() => {
    setSearch("")
    setRoleFilter("")
    setAreaFilter("")
    setStatusFilter(null)
    updateUrl("", "", "", null)
  }, [updateUrl])

  const handleInviteSuccess = useCallback(() => {
    // Refresh the page data to include newly invited user
    router.refresh()
  }, [router])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <>
      {stats && (
        <UserStatsGrid
          total={stats.total}
          active={stats.active}
          admins={stats.admins}
          pendingInvites={stats.pendingInvites}
          activeStatusFilter={statusFilter}
          activeRoleFilter={roleFilter}
          onClearAll={handleClearAll}
          onStatusSelected={handleStatusFilterChange}
          onAdminsSelected={handleAdminsSelected}
        />
      )}

      {/* Toolbar: search + filter + invite button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="max-w-xs flex-1">
            <Input
              placeholder="Buscar por nome, email ou cargo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              leadingIcon={<Search size={16} />}
              inputSize="sm"
            />
          </div>
          <div className="w-40">
            <Select
              selectSize="sm"
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
            >
              <option value="">Todos os papeis</option>
              <option value="student">Estudante</option>
              <option value="instructor">Instrutor</option>
              <option value="leader">Lider Educador</option>
              <option value="manager">Gestor</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          {areas.length > 0 && (
            <div className="w-44">
              <Select
                selectSize="sm"
                value={areaFilter}
                onChange={(e) => handleAreaFilterChange(e.target.value)}
              >
                <option value="">Todas as unidades</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} />
            Importar
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} />
            Convidar
          </Button>
        </div>
      </div>

      {/* Filtro ativo, sempre removível (AC8). */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-3 py-1 text-cerrado-400 text-sm">
            {DISPLAY_STATUS_FILTER_LABEL[statusFilter]}
            <button
              type="button"
              aria-label="Remover filtro"
              onClick={() => handleStatusFilterChange(null)}
              className="transition-colors hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      {statusFilterUnavailable && (
        <div className="rounded-md bg-semantic-warning/10 px-4 py-3 text-semantic-warning text-sm">
          Não foi possível verificar o estado dos convites agora, então o filtro não foi aplicado —
          a lista abaixo está completa.
        </div>
      )}

      {/* User list table */}
      <UserList
        initialData={initialData}
        initialCursor={initialCursor}
        currentUserId={currentUserId}
        search={search}
        roleFilter={roleFilter}
        areaFilter={areaFilter}
        statusFilter={statusFilter}
        jobRoles={jobRoles}
        areas={areas}
      />

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={handleInviteSuccess}
      />

      {/* Import em massa */}
      <UserBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleInviteSuccess}
      />
    </>
  )
}
