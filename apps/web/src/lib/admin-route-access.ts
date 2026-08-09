// =============================================================================
// Acesso às ROTAS administrativas — decisão PURA do guard de página
// =============================================================================
//
// Correção de auditoria (rodada 2), FURO 1 — "o eixo duplo continuava vivo".
//
// O middleware já decidia por CHAPÉUS reais (`admin-world.ts`), mas cada página
// de `/admin/*` ainda decidia por `profile.role`, a coluna SINGULAR. Resultado
// concreto: alguém com chapéu `admin` e `users.role = "instructor"` entrava no
// mundo do admin, clicava "Auditoria" na nav DO PRÓPRIO MUNDO e a página o
// mandava para `/dashboard` — que reescreve o cookie `x-active-workspace` para
// `standard`. Ele era EJETADO do mundo por clicar num item da própria barra.
//
// Aqui a decisão vira tabela + função pura (testável em `__tests__`, sem
// harness de Next), sempre sobre `hasAnyRole` (regra dura 3 da doutrina de
// workspaces). O conjunto permitido de CADA rota é transcrição 1:1 do guard que
// existia na página — nada estreitado, nada alargado (W4: nenhum acesso que
// existe hoje pode ser perdido).
// =============================================================================

import { hasAnyRole } from "@/lib/role-helpers"
import type { Role } from "@eximia/shared"

/**
 * Conjunto permitido por rota administrativa, transcrito VERBATIM dos guards de
 * página que existiam antes desta correção (só o EIXO mudou: coluna singular
 * `users.role` -> união de chapéus `user_roles`).
 *
 * A ordem dentro de cada lista é a ordem literal do guard original, de propósito:
 * facilita conferir linha a linha contra o `git show HEAD:<arquivo>`.
 */
export const ADMIN_ROUTE_ROLES = {
  /** `api-keys/page.tsx:12` */
  "/admin/api-keys": ["admin", "super_admin"],
  /** `areas/page.tsx:14` e `areas/[areaId]/page.tsx:17` — `manager` INCLUÍDO. */
  "/admin/areas": ["admin", "super_admin", "manager"],
  /** `audit/page.tsx:14` */
  "/admin/audit": ["admin", "super_admin"],
  /** `biblioteca/page.tsx:11` e `biblioteca/[bookId]/conteudo/page.tsx:14` */
  "/admin/biblioteca": ["admin", "super_admin"],
  /** `integrations/page.tsx:9` */
  "/admin/integrations": ["admin", "super_admin"],
  /** `job-roles/page.tsx:17` — `manager` E `instructor` INCLUÍDOS. */
  "/admin/job-roles": ["manager", "admin", "instructor", "super_admin"],
  /** `manager-groups/page.tsx:10` e `manager-groups/[groupId]/page.tsx:25` — `manager` INCLUÍDO. */
  "/admin/manager-groups": ["admin", "super_admin", "manager"],
  /** `plans/page.tsx:12` */
  "/admin/plans": ["admin", "super_admin"],
  /** `settings/page.tsx:15` */
  "/admin/settings": ["admin", "super_admin"],
  /** `tenants/page.tsx:11` e `tenants/[id]/page.tsx:17` — super_admin SOZINHO. */
  "/admin/tenants": ["super_admin"],
  /** `users/page.tsx:16` */
  "/admin/users": ["admin", "super_admin"],
  /** `webhooks/page.tsx:12` */
  "/admin/webhooks": ["admin", "super_admin"],
} as const satisfies Record<string, readonly Role[]>

export type AdminRoute = keyof typeof ADMIN_ROUTE_ROLES

/**
 * O guard de página, como função PURA: esta rota abre para este conjunto de
 * chapéus reais?
 *
 * É `hasAnyRole` por dentro — a rota só declara QUAL conjunto, nunca reimplementa
 * a checagem. Existir como função pura é o que permite ao teste da matriz provar
 * a decisão da PÁGINA, e não só a do middleware (FURO 5).
 */
export function canOpenAdminRoute(route: AdminRoute, hats: string[]): boolean {
  return hasAnyRole({ roles: hats }, [...ADMIN_ROUTE_ROLES[route]])
}

/**
 * Chapéu admin-tier, para as decisões de CAPACIDADE dentro de uma página que já
 * abriu (ex.: `isAdmin` em manager-groups, que libera ações de admin para quem
 * entrou como gestor).
 *
 * Espelha a precedência que a coluna singular expressava: `users.role` de um
 * `admin + manager` é "admin" (admin vence manager), então quem tem o chapéu
 * admin-tier NUNCA é tratado como gestor comum.
 */
export function isAdminTierActor(hats: string[]): boolean {
  return hasAnyRole({ roles: hats }, ["admin", "super_admin"])
}

/**
 * "Gestor comum": tem o chapéu de gestor e NÃO tem chapéu admin-tier.
 *
 * Substitui `profile.role === "manager"` sem mudar semântica: pela precedência
 * do banco (`recompute_primary_role`), a coluna singular só vale "manager"
 * quando a pessoa não é admin nem super_admin.
 */
export function isPlainManager(hats: string[]): boolean {
  return hasAnyRole({ roles: hats }, ["manager"]) && !isAdminTierActor(hats)
}

// =============================================================================
// FRONTEIRA DO EIXO — o que esta frente migrou e o que NÃO migrou (rodada 3)
// =============================================================================
//
// Fronteira declarada é aceitável; fronteira escondida não é. Esta seção existe
// para o próximo mantenedor não descobrir sozinho que o repo tem dois eixos.
//
// MIGRADO PARA CHAPÉUS (o que esta frente é dona):
//   - Todos os guards de PÁGINA de `/admin/*` (tabela `ADMIN_ROUTE_ROLES` acima).
//   - `lib/api-auth/require-admin.ts` — `requireAdmin`/`requireAdminOrManager`.
//     Motivo: `api/admin/audit-log/route.ts` foi CRIADA nesta frente e é a única
//     fonte de dados de `/admin/audit`, cuja página já decidia por chapéus. Os
//     dois lados da mesma tela, escritos na mesma rodada, estavam em eixos
//     opostos. Migrar o helper corrige a tela inteira de uma vez.
//   - `admin/settings/actions.ts` e `admin/settings/whitelabel-actions.ts`.
//     Motivo: foram TOCADAS por esta frente (ganharam `logAdminAction`).
//
// NÃO MIGRADO, DE PROPÓSITO — server actions que esta frente NÃO tocou:
//   - `app/(platform)/admin/plans/actions.ts:87,91`
//   - `app/(platform)/admin/job-roles/actions.ts:18,21`
//   - `app/(platform)/admin/manager-groups/actions.ts:107,116`
//   - `app/(platform)/admin/users/enrollment-actions.ts:56,61,106,118`
//   Confira a lista com:
//     grep -rn "profile\.role" apps/web/src/app/\(platform\)/admin/ | grep "actions.ts"
//
// NÃO MIGRADO, DE PROPÓSITO — rotas de API com gate SINGULAR inline (não passam
// por `require-admin.ts`), 62 arquivos em `app/api/`. Confira com:
//     grep -rln "profile\.role" apps/web/src/app/api/ | wc -l
// (Rodada 4: dizia 66. O comando que o próprio comentário prescreve devolve 62 —
// um número que ninguém conferiu é pior que nenhum número.)
//
// NÃO MIGRADO, DE PROPÓSITO — `lib/super-admin-auth.ts:19` (`requireSuperAdmin`),
// que decide por `profile.role !== "super_admin"`. Não é desta frente e nenhuma
// rota desta frente depende dele.
//
// RAZÃO (a mesma para os dois grupos): são CAMINHOS DE ESCRITA em produção, sem
// harness de teste, cada um com sua própria query `select("role, tenant_id")`.
// Migrá-los é uma rodada com gate próprio, não efeito colateral desta.
//
// POR QUE NÃO É REGRESSÃO: quem passa nesses gates hoje continua passando —
// nenhum deles foi tocado. E o eixo de chapéus não é mais permissivo nem mais
// restritivo na prática: em produção existem 3 usuários admin-tier e `user_roles`
// tem exatamente as 3 linhas correspondentes (os dois eixos concordam), com
// `recompute_primary_role` mantendo `users.role` derivado dos chapéus.
// =============================================================================
