"use client"

import { switchTenant } from "@/lib/actions/tenant-switch"
import { Select } from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface TenantOption {
  id: string
  name: string
  slug: string
}

interface TenantSwitcherProps {
  activeTenantId: string
  tenants: TenantOption[]
}

export function TenantSwitcher({ activeTenantId, tenants }: TenantSwitcherProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Only show if user has more than 1 tenant
  if (tenants.length <= 1) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tenantId = e.target.value
    if (tenantId === activeTenantId) return
    const newTenant = tenants.find((t) => t.id === tenantId)
    startTransition(async () => {
      const result = await switchTenant(tenantId)
      if (result.success && newTenant?.slug) {
        router.push(`/${newTenant.slug}/dashboard`)
      } else if (result.success) {
        router.refresh()
      }
    })
  }

  return (
    <Select
      selectSize="sm"
      value={activeTenantId}
      onChange={handleChange}
      disabled={isPending}
      className="max-w-[200px]"
      aria-label="Selecionar unidade"
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  )
}
