import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { GroupManagementClient } from "./_components/group-management-client"
import { loadManagerGroups } from "./loader"

export default async function ManagerGroupsPage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO — `manager` segue incluído. É por isto que esta rota
  // NÃO virou redirect para o hub: o hub é admin-tier e barraria o gestor.
  if (!canOpenAdminRoute("/admin/manager-groups", roles)) {
    return redirect("/dashboard")
  }

  // Mesma leitura consumida pela seção do hub (`/admin/configuracoes/grupos`):
  // um único loader, duas rotas, zero query duplicada.
  const loaded = await loadManagerGroups()
  if (loaded.kind === "unauthenticated") return redirect("/login")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Inclusões de Alcance"
        description="Acrescente alunos ao alcance de um gestor, além de quem já reporta a ele no organograma. Inclusões são aditivas: nunca removem ninguém da hierarquia."
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      <GroupManagementClient
        initialGroups={loaded.groups}
        gestores={loaded.gestores}
        units={loaded.units}
        isAdmin={loaded.isAdmin}
      />
    </div>
  )
}
