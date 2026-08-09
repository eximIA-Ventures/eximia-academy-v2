import { getAuthProfile } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

/**
 * Shell do hub de Configurações da organização.
 *
 * Fica DENTRO do route group `(platform)` existente: os providers
 * (QueryProvider, ModuleProvider, BrandProvider, AreaProvider, ContextProvider,
 * SessionTimeoutProvider), o Header e o CSS de tenant já são montados por
 * `(platform)/layout.tsx`.
 *
 * DRILL-IN (2026-07-28) — este layout NÃO monta mais uma segunda coluna de
 * navegação. A barra do hub passou a SUBSTITUIR a barra do mundo Admin dentro
 * de `/admin/configuracoes/*` (uma barra lateral por vez), e por isso ela vive
 * onde a barra do mundo já vive: `components/admin/admin-sidebar.tsx`, sob a
 * decisão pura `resolveAdminNavMode`. O selo "PRO" (CFG-4.1 AC1) continua
 * saindo do MESMO gate de plano de sempre — só que resolvido um nível acima,
 * no `(platform)/layout.tsx`, que é quem monta a barra.
 *
 * O que sobra aqui é o GUARD, e ele não mudou: admin-tier pela UNIÃO DE CHAPÉUS
 * (`roles[]`), nunca pelo `profile.role` singular legado (E7 §4.10 —
 * contexto/coluna singular não decide permissão). `getAuthProfile` é
 * `cache()`-ado, então não duplica query com o layout pai.
 */
export default async function ConfiguracoesHubLayout({ children }: { children: ReactNode }) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) redirect("/login")
  if (!hasAnyRole({ roles }, ["admin", "super_admin"])) redirect("/dashboard")

  return <div className="min-w-0">{children}</div>
}
