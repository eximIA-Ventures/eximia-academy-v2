import { AuditLogClient } from "@/components/admin/audit-log-client"
import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
}) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): o mesmo eixo do middleware. Conjunto
  // permitido inalterado (admin + super_admin).
  if (!canOpenAdminRoute("/admin/audit", roles)) return redirect("/dashboard")

  const { user: userParam } = await searchParams

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Auditoria"
        description="Trilha de ações administrativas do tenant: quem fez o quê, quando e de onde."
      />

      <AuditLogClient initialUserFilter={userParam ?? ""} />
    </div>
  )
}
