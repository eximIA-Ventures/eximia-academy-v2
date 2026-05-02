import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { AreaManagementClient } from "./_components/area-management-client"

export default async function AreasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "manager"].includes(profile.role)) {
    return tenantRedirect("/dashboard")
  }

  const { data: areas } = await supabase
    .from("areas")
    .select("id, name, slug, description, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("name")

  // Fetch counts per area
  const areaIds = (areas ?? []).map((a) => a.id)
  let userCounts: Record<string, number> = {}
  let courseCounts: Record<string, number> = {}

  if (areaIds.length > 0) {
    const [{ data: userAreaRows }, { data: courseRows }] = await Promise.all([
      supabase.from("user_areas").select("area_id").in("area_id", areaIds),
      supabase.from("courses").select("area_id").in("area_id", areaIds),
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
