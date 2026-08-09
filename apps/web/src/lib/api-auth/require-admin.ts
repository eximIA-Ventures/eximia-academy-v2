import { hasAnyRole } from "@/lib/role-helpers"
import type { createClient } from "@/lib/supabase/server"
import type { Role } from "@eximia/shared"

// =============================================================================
// Guard de ROTA DE API por CHAPÉUS REAIS (`user_roles`), nunca pela coluna
// singular `users.role`.
//
// Correção de auditoria (rodada 3). `api/admin/audit-log/route.ts` foi criada
// nesta frente e é a ÚNICA fonte de dados de `/admin/audit`, cuja PÁGINA já
// decidia por chapéus (`canOpenAdminRoute`). Os dois lados da mesma tela,
// escritos na mesma rodada, estavam em eixos opostos: a página abria pelo chapéu
// e a rota que a alimenta decidia pela coluna singular.
//
// Regra dura 3 da doutrina de workspaces: gate de papel usa `hasAnyRole`/`hasRole`
// sobre a união de chapéus. Aqui o conjunto permitido de cada função é
// TRANSCRIÇÃO 1:1 do que existia (`["admin","super_admin"]` e
// `["admin","manager","super_admin"]`); só o EIXO mudou.
//
// Por que é seguro (W4 — nenhum acesso que existe hoje pode ser perdido):
//   1. Fato de produção verificado: existem 3 usuários admin-tier e `user_roles`
//      tem exatamente as 3 linhas correspondentes. Os dois eixos CONCORDAM hoje.
//   2. `recompute_primary_role` mantém `users.role` derivado dos chapéus.
//   3. Fallback defensivo abaixo: perfil SEM nenhuma linha em `user_roles` cai
//      em `[profile.role]`, exatamente como `getAuthProfile` (`lib/auth.ts:47`).
//      Assim nem uma linha pré-backfill perde acesso.
//
// FRONTEIRA DECLARADA: esta rodada migrou só o que ESTA FRENTE é dona — este
// módulo (do qual `api/admin/audit-log` depende) e as 2 server actions de
// configurações que a frente tocou (`admin/settings/actions.ts` e
// `whitelabel-actions.ts`). A lista completa do que continua no eixo singular,
// com arquivo e motivo, está em `lib/admin-route-access.ts` (§FRONTEIRA DO EIXO).
// Fronteira declarada é aceitável; fronteira escondida não é.
// =============================================================================

/**
 * Colunas + embed dos chapéus. String literal ÚNICA de propósito: supabase-js só
 * infere o tipo do select sobre literais (mesma armadilha documentada em
 * `lib/auth.ts:30-33` — string concatenada colapsa para `GenericStringError` e
 * quebra o `next build`). O embed aponta a FK `user_id` porque `user_roles` tem
 * duas FKs para `users` (`user_id` e `granted_by`).
 */
const ACTOR_SELECT = "id, role, tenant_id, user_roles!user_roles_user_id_fkey(role)"

interface ActorProfile {
  id: string
  role: string
  tenant_id: string | null
}

/**
 * Carrega o ator e a UNIÃO DE CHAPÉUS dele numa única query.
 *
 * Devolve o perfil NARROWED para `{ id, role, tenant_id }` — exatamente a forma
 * pública que os chamadores sempre consumiram (`profile.tenant_id`), sem vazar o
 * embed para dentro deles.
 */
async function loadActor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, hats: [] as string[] }

  const { data } = await supabase.from("users").select(ACTOR_SELECT).eq("id", user.id).single()

  if (!data) return { user, profile: null, hats: [] as string[] }

  const row = data as unknown as ActorProfile & { user_roles?: { role: string }[] }
  const hats = (row.user_roles ?? []).map((r) => r.role)
  // Fallback defensivo pré-backfill, idêntico a `getAuthProfile`: sem nenhum
  // chapéu registrado, a coluna singular ainda vale como chapéu único.
  const effectiveHats = hats.length > 0 ? hats : row.role ? [row.role] : []

  const profile: ActorProfile = { id: row.id, role: row.role, tenant_id: row.tenant_id }
  return { user, profile, hats: effectiveHats }
}

/** Conjunto INALTERADO: admin-tier. Só o eixo mudou (singular -> chapéus). */
const ADMIN_HATS: Role[] = ["admin", "super_admin"]
/** Conjunto INALTERADO: admin-tier + gestor. Só o eixo mudou. */
const ADMIN_OR_MANAGER_HATS: Role[] = ["admin", "manager", "super_admin"]

export async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user, profile, hats } = await loadActor(supabase)
  if (!user) return { user: null, profile: null }

  if (!hasAnyRole({ roles: hats }, ADMIN_HATS)) return { user, profile: null }

  return { user, profile }
}

export async function requireAdminOrManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user, profile, hats } = await loadActor(supabase)
  if (!user) return { user: null, profile: null }

  if (!hasAnyRole({ roles: hats }, ADMIN_OR_MANAGER_HATS)) return { user, profile: null }

  return { user, profile }
}
