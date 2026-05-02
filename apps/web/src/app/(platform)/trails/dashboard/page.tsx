import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { getTrailDashboardData } from "./actions"
import { TrailDashboardClient } from "./trail-dashboard-client"

export default async function TrailDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) return redirect("/dashboard")

  // Only manager and admin roles can access the trail dashboard
  if (!["manager", "admin", "super_admin"].includes(profile.role)) {
    return redirect("/dashboard")
  }

  const result = await getTrailDashboardData()

  if ("error" in result) {
    return redirect("/dashboard")
  }

  const { data } = result

  return (
    <div className="space-y-6">
      <PageHeader
        section="Trilhas"
        title="Dashboard de Trilhas"
        description="Acompanhe o progresso dos alunos nas trilhas de aprendizagem"
      />
      <TrailDashboardClient
        trailStats={data.trailStats}
        roleCoverage={data.roleCoverage}
        studentProgress={data.studentProgress}
        trails={data.trails}
        roles={data.roles}
      />
    </div>
  )
}
