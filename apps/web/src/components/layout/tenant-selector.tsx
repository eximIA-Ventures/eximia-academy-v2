"use client"

import { Building2, Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface Tenant {
  id: string
  name: string
  slug: string
}

interface TenantSelectorProps {
  tenants: Tenant[]
  activeTenantId: string | null
}

export function TenantSelector({ tenants, activeTenantId }: TenantSelectorProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const activeTenant = tenants.find((t) => t.id === activeTenantId)

  function switchTenant(tenantId: string) {
    startTransition(async () => {
      await fetch("/api/admin/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })
      setOpen(false)
      router.refresh()
    })
  }

  if (tenants.length === 0) return null

  return (
    <div className="relative mr-auto">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl bg-bg-card shadow-card px-3 py-2 text-sm transition-all hover:shadow-elevated"
      >
        <Building2 size={14} className="text-cerrado-600" />
        <span className="font-medium text-text-primary max-w-[160px] truncate">
          {isPending ? "Trocando..." : activeTenant?.name ?? "Selecionar tenant"}
        </span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-30 w-64 rounded-xl bg-[var(--color-bg-card,#fff)] shadow-hero p-1.5 animate-dropdown-in">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Organizacoes
            </p>
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => switchTenant(tenant.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  tenant.id === activeTenantId
                    ? "bg-cerrado-600/10 text-cerrado-600 font-medium"
                    : "text-text-primary hover:bg-bg-hover"
                }`}
              >
                <Building2 size={14} className={tenant.id === activeTenantId ? "text-cerrado-600" : "text-text-muted"} />
                <span className="flex-1 truncate text-left">{tenant.name}</span>
                {tenant.id === activeTenantId && <Check size={14} className="text-cerrado-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
