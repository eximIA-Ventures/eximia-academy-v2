import { AreasWorkspaceClient } from "@/app/(platform)/admin/areas/_components/areas-workspace-client"
import { UnitsModuleUpsell } from "@/app/(platform)/admin/areas/_components/units-module-upsell"
import { loadAreasWorkspace } from "@/app/(platform)/admin/areas/departments-loader"
import { redirect } from "next/navigation"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesUnidadesPage() {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus).
  //
  // A rota antiga `/admin/areas` segue viva, liberada para `manager` e com a
  // TABELA de sempre — de propósito. O Mapa e a Lista v2 escrevem em
  // `department_areas` por rotas admin-only; oferecê-los a um gestor seria expor
  // botões que respondem 403. Quem tem o chapéu certo chega aqui pelo hub.
  const loaded = await loadAreasWorkspace()
  if (loaded.kind === "unauthenticated") redirect("/login")

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Unidades & Áreas"
        description="A unidade é o lugar; a área é o time funcional que vive nela. Uma área presente em mais de uma unidade é corporativa."
      />

      {loaded.kind === "module-disabled" ? (
        <UnitsModuleUpsell />
      ) : (
        <AreasWorkspaceClient areas={loaded.areas} snapshot={loaded.snapshot} />
      )}
    </div>
  )
}
