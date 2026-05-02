import { PageHeader } from "@/components/layout/page-header"
import { AuditLogClient } from "@/components/super-admin/audit-log-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Log de Auditoria | Super Admin",
}

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title="Log de Auditoria"
        description="Acompanhe todas as acoes realizadas na plataforma."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1563986768609-322da13575f2?w=1200&q=80"
      />
      <AuditLogClient />
    </div>
  )
}
