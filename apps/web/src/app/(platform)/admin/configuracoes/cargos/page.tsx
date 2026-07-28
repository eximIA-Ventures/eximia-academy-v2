import { JobRolesClient } from "@/app/(platform)/admin/job-roles/job-roles-client"
import { loadAdminJobRoles } from "@/app/(platform)/admin/job-roles/loader"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesCargosPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  // A rota antiga `/admin/job-roles` segue viva para `manager` e `instructor`.
  const { roles, areas, trails } = await loadAdminJobRoles()

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cargos"
        description="Gerencie os cargos da sua organização e vincule trilhas de aprendizagem."
      />

      <JobRolesClient roles={roles} areas={areas} trails={trails} />
    </div>
  )
}
