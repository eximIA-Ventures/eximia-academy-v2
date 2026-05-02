import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { listJobRolesWithStats, listAreas } from "./actions"
import { JobRolesClient } from "./job-roles-client"

export default async function JobRolesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "instructor", "super_admin"].includes(profile.role)) {
    return tenantRedirect("/dashboard")
  }

  const [rolesResult, areasResult] = await Promise.all([listJobRolesWithStats(), listAreas()])

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Cargos"
        description="Gerencie os cargos da sua organização e vincule trilhas de aprendizagem."
        accent="blue"
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />
      <JobRolesClient roles={rolesResult.data ?? []} areas={areasResult.data ?? []} />
    </div>
  )
}
