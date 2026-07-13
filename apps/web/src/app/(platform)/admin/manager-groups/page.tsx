import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { redirect } from "next/navigation"
import { GroupManagementClient } from "./_components/group-management-client"
import { listGestorOptions, listManagerGroups, listUnitOptions } from "./actions"

export default async function ManagerGroupsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin", "manager"].includes(profile.role)) {
    return redirect("/dashboard")
  }

  const [groupsResult, gestoresResult, unitsResult] = await Promise.all([
    listManagerGroups(),
    listGestorOptions(),
    listUnitOptions(),
  ])

  const groups = groupsResult.data ?? []
  const gestores = gestoresResult.data ?? []
  const units = unitsResult.data ?? []

  const isAdmin = profile.role === "admin" || profile.role === "super_admin"

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Inclusões de Alcance"
        description="Acrescente alunos ao alcance de um gestor, além de quem já reporta a ele no organograma. Inclusões são aditivas: nunca removem ninguém da hierarquia."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      <GroupManagementClient
        initialGroups={groups}
        gestores={gestores}
        units={units}
        isAdmin={isAdmin}
      />
    </div>
  )
}
