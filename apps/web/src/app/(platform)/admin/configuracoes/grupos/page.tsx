import { GroupManagementClient } from "@/app/(platform)/admin/manager-groups/_components/group-management-client"
import { loadManagerGroups } from "@/app/(platform)/admin/manager-groups/loader"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesGruposPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  // A rota antiga `/admin/manager-groups` segue VIVA e liberada para `manager`,
  // que o hub não libera — por isso ela não virou redirect.
  const loaded = await loadManagerGroups()
  if (loaded.kind === "unauthenticated") redirect("/login")

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Grupos de gestores"
        description="Acrescente alunos ao alcance de um gestor, além de quem já reporta a ele no organograma. Inclusões são aditivas: nunca removem ninguém da hierarquia."
      />

      {/* Exatamente o mesmo componente da tela antiga — o que muda é a moldura. */}
      <GroupManagementClient
        initialGroups={loaded.groups}
        gestores={loaded.gestores}
        units={loaded.units}
        isAdmin={loaded.isAdmin}
      />
    </div>
  )
}
