import { getAuthProfile } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { AdminDashboardSlot } from "../dashboard/_components/admin-dashboard-slot"

/**
 * Home do MUNDO DO ADMIN (W1/W2).
 *
 * Entrar pelo picker no cartão "Administração" cai AQUI, num painel de
 * administração — não numa tela de ajuste. O componente é o mesmo painel que
 * `/dashboard` renderiza para o admin (via `AdminDashboardSlot`); o que muda é
 * o MUNDO em volta (shell/nav administrativa, resolvido em `(platform)/layout`).
 *
 * Guard por CHAPÉU real (regra dura 3 da doutrina de workspaces), espelhando
 * `admin/configuracoes/layout.tsx`. O middleware já barra antes; este guard é o
 * fail-closed de página, para a rota nunca depender só do middleware.
 */
export default async function AdminHomePage() {
  const { user, profile, roles, supabase } = await getAuthProfile()

  if (!user || !profile) redirect("/login")
  if (!hasAnyRole({ roles }, ["admin", "super_admin"])) redirect("/dashboard")

  // RODADA 9 — o desvio `super_admin => SuperAdminDashboardPage` SAIU daqui.
  // Este mundo é a administração DA EMPRESA ATIVA, e era o único ponto em que
  // ele mostrava outra coisa (o painel global) para um chapéu específico. O
  // painel global mudou de endereço e de mundo: `/super-admin` (4º mundo). O
  // `super_admin` que entra aqui vê o painel administrativo da empresa ativa —
  // a mesma tela do admin de tenant, resolvida pelo MESMO slot (o
  // `AdminDashboardSlot` já cobre `tenant_id` nulo com service client +
  // `resolveTenantId`, que lê a empresa ativa do seletor do cabeçalho).
  return (
    <AdminDashboardSlot
      supabase={supabase}
      // Literal "admin" e não `profile.role`: o prop é morto a jusante —
      // `AdminDashboardPage` desestrutura `role` e não o usa. O eixo singular
      // não tem por que aparecer numa rota administrativa.
      role="admin"
      tenantId={profile.tenant_id}
      fullName={profile.full_name}
    />
  )
}
