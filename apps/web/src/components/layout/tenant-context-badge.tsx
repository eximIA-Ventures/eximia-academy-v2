"use client"

import { exitTenantContext } from "@/app/super-admin/tenants/actions"
import { Button } from "@eximia/ui"
import { ArrowLeft, Building2 } from "lucide-react"
import { useTransition } from "react"

interface TenantContextBadgeProps {
  tenantName: string
}

export function TenantContextBadge({ tenantName }: TenantContextBadgeProps) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-md bg-accent-blue-mid/15 px-2.5 py-1">
        <Building2 size={14} className="text-accent-blue-light" />
        <span className="text-xs font-medium text-accent-blue-light">
          Gerenciando: {tenantName}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        disabled={pending}
        onClick={() => startTransition(() => exitTenantContext())}
      >
        <ArrowLeft size={14} />
        {pending ? "Saindo..." : "Voltar ao Painel"}
      </Button>
    </div>
  )
}
