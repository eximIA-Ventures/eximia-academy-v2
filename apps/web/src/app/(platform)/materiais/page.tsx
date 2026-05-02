import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { redirect } from "next/navigation"
import { MateriaisPageClient } from "@/components/materiais/materiais-page-client"

export default async function MateriaisPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()

  if (!profile) return redirect("/login")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Recursos"
        title="Materiais"
        description="Arquivos de apoio, apresentacoes e documentos complementares para seu aprendizado."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=1200&q=80"
      />

      <MateriaisPageClient role={profile.role} tenantId={profile.tenant_id} />
    </div>
  )
}
