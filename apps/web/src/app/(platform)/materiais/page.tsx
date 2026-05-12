import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { redirect } from "next/navigation"
import { MateriaisPageClient } from "@/components/materiais/materiais-page-client"

export default async function MateriaisPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const tenantId = await resolveTenantId(profile.tenant_id)

  return (
    <div className="space-y-6">
      <PageHeader
        section="Recursos"
        title="Materiais"
        description="Arquivos de apoio, apresentacoes e documentos complementares para seu aprendizado."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=1200&q=80"
      />

      <MateriaisPageClient role={profile.role} tenantId={tenantId ?? ""} />
    </div>
  )
}
