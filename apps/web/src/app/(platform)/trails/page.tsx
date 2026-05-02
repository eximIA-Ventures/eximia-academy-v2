import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { listTrails } from "./actions"
import { TrailsListClient } from "./trails-list-client"

export default async function TrailsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) return tenantRedirect("/dashboard")

  const { data: trails } = await listTrails()

  return (
    <div className="space-y-6">
      <PageHeader
        section="Trilhas"
        title={profile.role === "student" ? "Minhas Trilhas" : "Trilhas de Aprendizagem"}
        description={
          profile.role === "student"
            ? "Acompanhe seu progresso nas trilhas de desenvolvimento"
            : "Gerencie trilhas de aprendizagem vinculadas a cargos"
        }
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80"
      />
      <TrailsListClient trails={trails ?? []} userRole={profile.role} />
    </div>
  )
}
