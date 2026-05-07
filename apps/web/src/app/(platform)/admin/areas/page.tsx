import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import { getTenantConfig } from "@/lib/tenant"
import { Building2, Mail } from "lucide-react"
import { redirect } from "next/navigation"
import { AreaManagementClient } from "./_components/area-management-client"

export default async function AreasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "manager"].includes(profile.role)) {
    return redirect("/dashboard")
  }

  // Check if units module is enabled
  const tenantConfig = getTenantConfig()
  const enabledModules = tenantConfig.modules ?? []
  const unitsEnabled = enabledModules.includes("units")

  if (!unitsEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          section="Administração"
          title="Unidades Gerenciais"
          description="Gerencie as unidades gerenciais da sua empresa."
          accent="teal"
          backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
        />

        <div className="mx-auto max-w-lg rounded-2xl bg-bg-card shadow-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cerrado-600/10">
            <Building2 size={28} className="text-cerrado-600" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Modulo Unidades Gerenciais
          </h2>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Organize sua empresa em unidades (filiais, plantas, departamentos) com dashboards
            e filtros independentes por unidade.
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Este modulo nao esta incluso no seu plano atual.
          </p>
          <a
            href="mailto:contato@eximiaventures.com.br?subject=Interesse%20em%20Unidades%20Gerenciais"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cerrado-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cerrado-700 active:scale-[0.98]"
          >
            <Mail size={16} />
            Entrar em contato
          </a>
        </div>
      </div>
    )
  }

  // Resolve tenant: super_admin uses cookie, others use profile
  let tenantId = profile.tenant_id
  if (profile.role === "super_admin" && !tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
    if (!tenantId) {
      const { data: firstTenant } = await supabase.from("tenants").select("id").limit(1)
      tenantId = firstTenant?.[0]?.id ?? null
    }
  }

  // Super admin: use service role to bypass RLS
  let areasClient = supabase
  if (profile.role === "super_admin") {
    const { createServiceClient } = await import("@/lib/supabase/service")
    areasClient = createServiceClient()
  }

  const { data: areas } = await areasClient
    .from("areas")
    .select("id, name, slug, description, created_at")
    .eq("tenant_id", tenantId)
    .order("name")

  // Fetch counts per area
  const areaIds = (areas ?? []).map((a) => a.id)
  let userCounts: Record<string, number> = {}
  let courseCounts: Record<string, number> = {}

  if (areaIds.length > 0) {
    const [{ data: userAreaRows }, { data: courseRows }] = await Promise.all([
      areasClient.from("user_areas").select("area_id").in("area_id", areaIds),
      areasClient.from("courses").select("area_id").in("area_id", areaIds),
    ])
    for (const r of userAreaRows ?? []) {
      userCounts[r.area_id] = (userCounts[r.area_id] ?? 0) + 1
    }
    for (const r of courseRows ?? []) {
      if (r.area_id) courseCounts[r.area_id] = (courseCounts[r.area_id] ?? 0) + 1
    }
  }

  const areasWithCounts = (areas ?? []).map((a) => ({
    ...a,
    user_count: userCounts[a.id] ?? 0,
    course_count: courseCounts[a.id] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Unidades"
        description="Gerencie as unidades gerenciais da sua empresa."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />

      <AreaManagementClient initialAreas={areasWithCounts} />
    </div>
  )
}
