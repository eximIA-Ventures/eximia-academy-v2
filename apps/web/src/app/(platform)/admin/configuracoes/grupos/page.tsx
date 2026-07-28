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
      {/* RENOMEADO (dono, 2026-07-28): "Grupos de gestores" -> "Times", o mesmo
          rótulo do item da barra — tela e navegação não podem dizer coisas
          diferentes. O subtítulo passa a nomear o que a pessoa vem fazer aqui
          (times e hierarquia) SEM inventar função nova: o que a tela faz continua
          sendo, literalmente, acrescentar alunos ao alcance de um gestor. */}
      <SectionHeader
        title="Times"
        description="Organize os times e a hierarquia: acrescente alunos ao alcance de um gestor, além de quem já reporta a ele no organograma. Inclusões são aditivas: nunca removem ninguém da hierarquia."
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
