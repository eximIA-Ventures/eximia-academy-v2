"use client"

import { InviteUserDialog } from "@/components/admin/invite-user-dialog"
import { type AdminUser, UserList } from "@/components/admin/user-list"
import { Button, Input, Select } from "@eximia/ui"
import { Search, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

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
}: UserManagementClientProps) {
  const router = useRouter()

  const [search, setSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter)
  const [areaFilter, setAreaFilter] = useState(initialAreaFilter)
  const [inviteOpen, setInviteOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced URL update for search
  const updateUrl = useCallback(
    (newSearch: string, newRole: string, newArea: string) => {
      const params = new URLSearchParams()
      if (newSearch) params.set("search", newSearch)
      if (newRole) params.set("role", newRole)
      if (newArea) params.set("area_id", newArea)
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
        updateUrl(value, roleFilter, areaFilter)
      }, 300)
    },
    [roleFilter, areaFilter, updateUrl],
  )

  const handleRoleFilterChange = useCallback(
    (value: string) => {
      setRoleFilter(value)
      updateUrl(search, value, areaFilter)
    },
    [search, areaFilter, updateUrl],
  )

  const handleAreaFilterChange = useCallback(
    (value: string) => {
      setAreaFilter(value)
      updateUrl(search, roleFilter, value)
    },
    [search, roleFilter, updateUrl],
  )

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
      {/* Toolbar: search + filter + invite button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="max-w-xs flex-1">
            <Input
              placeholder="Buscar por nome ou email..."
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

        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus size={16} />
          Convidar
        </Button>
      </div>

      {/* User list table */}
      <UserList
        initialData={initialData}
        initialCursor={initialCursor}
        currentUserId={currentUserId}
        search={search}
        roleFilter={roleFilter}
        areaFilter={areaFilter}
      />

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={handleInviteSuccess}
      />
    </>
  )
}
