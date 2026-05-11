import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { PageHeader } from "@/components/layout/page-header"
import { listAvailableCourses, listJobRolesForTrails } from "../actions"
import { TrailBuilderClient } from "./trail-builder-client"

export default async function NewTrailPage() {
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["instructor", "admin", "super_admin"].includes(profile.role)) {
    return redirect("/trails")
  }

  const [coursesResult, rolesResult] = await Promise.all([
    listAvailableCourses(),
    listJobRolesForTrails(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        section="Trilhas"
        title="Nova Trilha"
        description="Crie uma trilha de aprendizagem combinando cursos em sequencia"
      />
      <TrailBuilderClient
        courses={coursesResult.data ?? []}
        jobRoles={rolesResult.data ?? []}
      />
    </div>
  )
}
