import { AuditLogClient } from "@/components/admin/audit-log-client"
import { SectionHeader } from "../_components/section-header"

export default async function ConfiguracoesAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
}) {
  // Guard admin-tier já aplicado no `layout.tsx` do hub (união de chapéus) —
  // o MESMO conjunto de `ADMIN_ROUTE_ROLES["/admin/audit"]`. A rota antiga
  // `/admin/audit` segue VIVA e sem redirect.
  //
  // Não há loader a compartilhar aqui: a tela de auditoria é client-side e lê
  // por `GET /api/admin/audit-log` (que tem o próprio gate `requireAdmin`).
  const { user: userParam } = await searchParams

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Auditoria"
        description="Trilha de ações administrativas do tenant: quem fez o quê, quando e de onde."
      />

      {/* Exatamente o mesmo componente da tela antiga. */}
      <AuditLogClient initialUserFilter={userParam ?? ""} />
    </div>
  )
}
