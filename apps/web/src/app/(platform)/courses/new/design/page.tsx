import { redirect } from "next/navigation"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { CourseDesignerWizard } from "./_components/course-designer-wizard"

export default async function CourseDesignerPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return redirect("/dashboard")
  }

  const tenantId = await resolveTenantId(profile.tenant_id)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Course Designer</h1>
        <p className="text-text-secondary">
          Crie um blueprint pedagógico completo com assistência de IA
        </p>
      </div>
      <CourseDesignerWizard tenantId={tenantId!} />
    </div>
  )
}
