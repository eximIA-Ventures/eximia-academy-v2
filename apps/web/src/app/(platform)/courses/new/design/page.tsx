import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CourseDesignerWizard } from "./_components/course-designer-wizard"

export default async function CourseDesignerPage() {
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

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return tenantRedirect("/dashboard")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Course Designer</h1>
        <p className="text-text-secondary">
          Crie um blueprint pedagógico completo com assistência de IA
        </p>
      </div>
      <CourseDesignerWizard tenantId={profile.tenant_id} />
    </div>
  )
}
