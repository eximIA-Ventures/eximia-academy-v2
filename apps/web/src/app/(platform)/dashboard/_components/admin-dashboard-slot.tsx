import type { createClient } from "@/lib/supabase/server"
import { AdminDashboardPage } from "./admin-dashboard-page"

interface AdminDashboardSlotProps {
  supabase: Awaited<ReturnType<typeof createClient>>
  role: "admin" | "super_admin"
  /** `profile.tenant_id` — null para o admin global (multi-tenant). */
  tenantId: string | null
  fullName: string
}

/**
 * Resolve o tenant (service client quando o admin é GLOBAL, i.e. `tenant_id`
 * nulo, para furar a RLS) e renderiza o painel administrativo.
 *
 * Existe para que o painel tenha UM único lugar de resolução consumido por dois
 * pontos de entrada — `/dashboard` (mundo Padrão, precedência de chapéu) e
 * `/admin` (home do mundo Admin, W2) — sem duplicar o componente nem a
 * resolução de tenant. O corpo é o antigo `case "admin"` de `dashboard/page.tsx`,
 * movido verbatim.
 */
export async function AdminDashboardSlot({
  supabase,
  role,
  tenantId,
  fullName,
}: AdminDashboardSlotProps) {
  // Admin global (null tenant) needs service client to bypass RLS.
  // (Preserved integrally from the previous admin branch.)
  let dbClient = supabase
  let resolvedTenantId = tenantId
  if (!tenantId) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    dbClient = createServiceClient()
    const { resolveTenantId } = await import("@/lib/auth")
    resolvedTenantId = await resolveTenantId(null)
  }
  return (
    <AdminDashboardPage
      supabase={dbClient}
      role={role}
      tenantId={resolvedTenantId}
      fullName={fullName}
    />
  )
}
