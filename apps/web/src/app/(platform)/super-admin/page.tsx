import { getAuthProfile } from "@/lib/auth"
import { hasRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import { SuperAdminDashboardPage } from "../dashboard/_components/super-admin-dashboard-page"

/**
 * Home do 4º MUNDO — SUPER ADMIN (rodada 9).
 *
 * POR QUE ESTE MUNDO EXISTE. Até aqui, o `super_admin` que entrava pelo cartão
 * "Plataforma de Aprendizagem" caía no painel GLOBAL de todas as empresas: o
 * mundo de APRENDIZAGEM contendo ADMINISTRAÇÃO, exatamente a fronteira que
 * `docs/stories/workspace-separation.story.md` proíbe. A administração global
 * ganha mundo próprio, e o Padrão volta a ser o produto como o cliente o vê
 * (ver `resolveDashboardKind`, eixo `workspace`).
 *
 * POR QUE A ROTA É `/super-admin`. Cada mundo tem como home um SEGMENTO DE TOPO
 * com o nome dele (`/dashboard`, `/instructor`, `/admin`); o 4º segue o mesmo
 * padrão. `/admin/tenants` não serve de home porque é uma SEÇÃO deste mundo
 * ("Empresas"), não a porta dele. Nenhuma URL pública muda: `/super-admin`
 * nunca existiu no app.
 *
 * Guard por CHAPÉU real (regra dura 3 da doutrina), espelhando `admin/page.tsx`.
 * O middleware já barra antes; este é o fail-closed de página, para a rota nunca
 * depender só do middleware. Quem é admin-tier mas não super_admin volta para a
 * home do mundo dele (`/admin`), nunca para `/dashboard` — ir ao Padrão
 * reescreveria o cookie de workspace e o expulsaria do mundo em que está.
 */
export default async function SuperAdminHomePage() {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) redirect("/login")
  if (!hasRole({ roles }, "super_admin")) {
    redirect(roles.includes("admin") ? "/admin" : "/dashboard")
  }

  return <SuperAdminDashboardPage fullName={profile.full_name} />
}
