import { isAdminTierActor } from "@/lib/admin-route-access"
import { getAuthProfile } from "@/lib/auth"
import type { ManagerGroupRow, ManagerOption, UnitOption } from "./actions"
import { listGestorOptions, listManagerGroups, listUnitOptions } from "./actions"

/**
 * Loader único de "Grupos de Gestor" / "Inclusões de Alcance".
 *
 * Extraído de `manager-groups/page.tsx` para que a rota antiga
 * (`/admin/manager-groups`, que segue VIVA e liberada também para `manager`) e a
 * seção do hub (`/admin/configuracoes/grupos`, admin-tier) leiam PELA MESMA
 * leitura — nenhuma tela é reescrita, nenhuma query é duplicada. Mesmo padrão de
 * `admin/settings/loader.ts` e `admin/users/loader.ts`.
 *
 * O loader NÃO redireciona: cada rota aplica o próprio guard (a antiga via
 * `canOpenAdminRoute`, o hub via `hasAnyRole` no `layout.tsx`) e decide o que
 * fazer com cada `kind`.
 */
export type ManagerGroupsLoad =
  | { kind: "unauthenticated" }
  | {
      kind: "ok"
      groups: ManagerGroupRow[]
      gestores: ManagerOption[]
      units: UnitOption[]
      /** Capacidade DENTRO da tela (ações de admin), pelo chapéu real. */
      isAdmin: boolean
    }

export async function loadManagerGroups(): Promise<ManagerGroupsLoad> {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return { kind: "unauthenticated" }

  const [groupsResult, gestoresResult, unitsResult] = await Promise.all([
    listManagerGroups(),
    listGestorOptions(),
    listUnitOptions(),
  ])

  return {
    kind: "ok",
    groups: groupsResult.data ?? [],
    gestores: gestoresResult.data ?? [],
    units: unitsResult.data ?? [],
    // `users.role` de um `admin + manager` é "admin" por precedência do banco,
    // então o chapéu admin-tier expressa exatamente o mesmo que a comparação
    // singular antiga.
    isAdmin: isAdminTierActor(roles),
  }
}
