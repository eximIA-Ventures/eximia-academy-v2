import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AreaManagementClient } from "./_components/area-management-client"
import { UnitsModuleUpsell } from "./_components/units-module-upsell"
import { loadAdminAreas } from "./loader"

export default async function AreasPage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user) return redirect("/login")

  // Guard INALTERADO no CONJUNTO (`manager` continua entrando por esta rota, a
  // rota antiga segue viva justamente para não revogar esse acesso); só o EIXO
  // mudou para os chapéus reais (regra dura 3).
  if (!profile || !canOpenAdminRoute("/admin/areas", roles)) {
    return redirect("/dashboard")
  }

  // Mesma leitura consumida por `/admin/configuracoes/unidades`.
  const loaded = await loadAdminAreas()
  if (loaded.kind === "unauthenticated") return redirect("/login")

  if (loaded.kind === "module-disabled") {
    return (
      <div className="space-y-6">
        <PageHeader
          section="Administração"
          title="Unidades Gerenciais"
          description="Gerencie as unidades gerenciais da sua empresa."
          backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
        />

        <UnitsModuleUpsell />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Unidades"
        description="Gerencie as unidades gerenciais da sua empresa."
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />

      <AreaManagementClient initialAreas={loaded.areas} />
    </div>
  )
}
