import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { loadAdminUsers } from "./loader"
import { UserManagementClient } from "./user-management-client"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO.
  if (!canOpenAdminRoute("/admin/users", roles)) return redirect("/dashboard")

  // Mesma leitura consumida por `/admin/configuracoes/usuarios`.
  const loaded = await loadAdminUsers(await searchParams)
  if (loaded.kind === "unauthenticated") return redirect("/login")

  const data = loaded.data

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Usuários"
        description="Gerencie usuários, convites e permissões."
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      {/* Contadores + busca + filtros + lista. Os cards do topo entram DENTRO do
          client porque clicar num deles é aplicar um filtro (CFG-6.1, AC8). */}
      <UserManagementClient
        initialData={data.users}
        initialCursor={data.cursor}
        currentUserId={data.currentUserId}
        initialSearch={data.search}
        initialRoleFilter={data.roleFilter}
        areas={data.areas}
        initialAreaFilter={data.areaFilter}
        jobRoles={data.jobRoles}
        initialStatusFilter={data.statusFilter}
        statusFilterUnavailable={data.statusFilterUnavailable}
        listError={data.listError}
        stats={data.stats}
      />
    </div>
  )
}
