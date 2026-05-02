import { PageHeader } from "@/components/layout/page-header"
import { CreateTenantWizard } from "@/components/super-admin/create-tenant-wizard"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function NewTenantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title="Nova Empresa"
        description="Preencha os dados para criar uma nova empresa na plataforma."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80"
      />
      <CreateTenantWizard />
    </div>
  )
}
