import { PageHeader } from "@/components/layout/page-header"
import { GlobalDashboardClient } from "@/components/super-admin/global-dashboard-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Dashboard Global | Super Admin",
}

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Painel Global"
        title="Super Admin"
        description="Visão consolidada de todas as empresas, usuários e métricas da plataforma."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
      />

      <GlobalDashboardClient />
    </div>
  )
}
