import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile, getDbClient } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { JobRolesClient } from "./job-roles-client"
import { loadAdminJobRoles } from "./loader"

export default async function JobRolesPage() {
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO — `manager` e `instructor` seguem incluídos (W4).
  // `hats` (e não `roles`) porque `roles` aqui já é o nome dos CARGOS carregados
  // logo abaixo — duas coisas diferentes com o mesmo nome seria armadilha.
  const { roles: hats } = await getAuthProfile()

  if (!canOpenAdminRoute("/admin/job-roles", hats)) {
    return redirect("/dashboard")
  }

  // Mesma leitura consumida por `/admin/configuracoes/cargos`.
  const { roles, areas, trails } = await loadAdminJobRoles()

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Cargos"
        description="Gerencie os cargos da sua organização e vincule trilhas de aprendizagem."
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />
      <JobRolesClient roles={roles} areas={areas} trails={trails} />
    </div>
  )
}
