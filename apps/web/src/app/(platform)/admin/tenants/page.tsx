import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { adminWorldDeniedRedirect } from "@/lib/admin-world"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { MapPin, Users } from "lucide-react"
import { redirect } from "next/navigation"
import { TenantsManagementClient } from "./_components/tenants-management-client"

export default async function TenantsPage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO. Só super_admin.
  //
  // Rodada 5: o destino da recusa deixou de ser `/dashboard` fixo. Esta é a
  // ÚNICA rota do mundo admin que recusa um admin-tier, e mandá-lo a
  // `/dashboard` reescrevia o cookie de mundo para `standard` — ele perdia o
  // MUNDO por pedir uma ROTA. Quem não é admin-tier continua indo a
  // `/dashboard`, idêntico ao de antes (`adminWorldDeniedRedirect`).
  if (!canOpenAdminRoute("/admin/tenants", roles)) return redirect(adminWorldDeniedRedirect(roles))

  const supabase = createServiceClient()

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("name")

  const tenantIds = (tenants ?? []).map((t) => t.id)

  // User counts per tenant
  const { data: allUsers } = await supabase
    .from("users")
    .select("tenant_id")
    .in("tenant_id", tenantIds)

  const userCountMap: Record<string, number> = {}
  for (const u of allUsers ?? []) {
    if (u.tenant_id) userCountMap[u.tenant_id] = (userCountMap[u.tenant_id] ?? 0) + 1
  }

  // Areas per tenant
  const { data: allAreas } = await supabase
    .from("areas")
    .select("id, name, slug, tenant_id")
    .in("tenant_id", tenantIds)
    .order("name")

  const areasByTenant: Record<string, Array<{ id: string; name: string; slug: string }>> = {}
  for (const a of allAreas ?? []) {
    const list = areasByTenant[a.tenant_id] ?? []
    list.push(a)
    areasByTenant[a.tenant_id] = list
  }

  const tenantsData = (tenants ?? []).map((t) => ({
    ...t,
    user_count: userCountMap[t.id] ?? 0,
    area_count: (areasByTenant[t.id] ?? []).length,
    areas: areasByTenant[t.id] ?? [],
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title="Empresas"
        description="Gerencie todas as empresas cadastradas na plataforma."
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />

      <TenantsManagementClient tenants={tenantsData} />
    </div>
  )
}
