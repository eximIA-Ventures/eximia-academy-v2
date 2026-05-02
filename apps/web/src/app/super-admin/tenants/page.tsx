import { PageHeader } from "@/components/layout/page-header"
import { TenantListClient } from "@/components/super-admin/tenant-list-client"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export default async function TenantsPage() {
  // Verify auth + role server-side (layout already checks, but belt-and-suspenders)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    return null
  }

  // Fetch initial tenants using service client
  const serviceClient = createServiceClient()
  const { data: tenants } = await serviceClient
    .from("tenants")
    .select("id, name, slug, plan, status, whitelabel_enabled, created_at")
    .order("created_at", { ascending: false })
    .limit(21)

  const hasMore = tenants && tenants.length > 20
  const items = hasMore ? tenants.slice(0, 20) : (tenants ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  // Fetch user counts
  const tenantIds = items.map((t) => t.id)
  let userCounts: Record<string, number> = {}

  if (tenantIds.length > 0) {
    const countPromises = tenantIds.map(async (tid) => {
      const { count } = await serviceClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
      return { tid, count: count ?? 0 }
    })
    const countResults = await Promise.all(countPromises)
    for (const { tid, count } of countResults) {
      userCounts[tid] = count
    }
  }

  const initialTenants = items.map((t) => ({
    ...t,
    user_count: userCounts[t.id] || 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title="Empresas"
        description="Gerencie todas as empresas cadastradas na plataforma."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />
      <TenantListClient initialTenants={initialTenants} initialNextCursor={nextCursor ?? null} />
    </div>
  )
}
