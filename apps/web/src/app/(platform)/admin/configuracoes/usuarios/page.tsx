import { loadAdminUsers } from "@/app/(platform)/admin/users/loader"
import { UserManagementClient } from "@/app/(platform)/admin/users/user-management-client"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  const loaded = await loadAdminUsers(await searchParams)
  if (loaded.kind === "unauthenticated") redirect("/login")

  const data = loaded.data

  return (
    <div className="space-y-6">
      <SectionHeader title="Usuários" description="Gerencie usuários, convites e permissões." />

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
        stats={data.stats}
      />
    </div>
  )
}
