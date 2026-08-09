import { INVITE_TTL_MS } from "./ttl"

/**
 * Estado EXIBIDO de um usuário (CFG-2.2, AC2).
 *
 * ## A regra que não pode ser quebrada
 *
 * Este módulo é PURO e DERIVA. Ele não escreve nada, e em particular não escreve
 * `users.status` — a coluna continua com exatamente os dois valores que a
 * `users_status_check` permite (`'active'`/`'inactive'`,
 * `20260209000000_epic11_super_admin_whitelabel.sql:25`) e com exatamente o
 * mesmo significado de antes desta story. "Convite pendente" e "Convite
 * expirado" existem apenas em memória, montados a partir do que o Supabase Auth
 * já guarda (`invited_at`/`confirmed_at`).
 *
 * ## Por que é puro (e por que isso importa para o bundle)
 *
 * A pílula da lista roda no cliente (`components/admin/user-list.tsx`, `"use
 * client"`). Se a derivação morasse junto do accessor privilegiado
 * (`admin/users/auth-accounts.ts`, que importa o service role), o cliente
 * arrastaria aquele módulo para o bundle. Aqui não há nenhum import de servidor:
 * só a constante de TTL.
 *
 * ## Degradação graciosa (AC9)
 *
 * Quando o Auth está fora do ar, o accessor devolve mapa vazio e os campos
 * chegam `undefined`. Sem `invited_at` não há como afirmar "pendente", e a
 * função cai sozinha no par binário Ativo/Inativo de sempre — que é exatamente o
 * comportamento anterior a esta story. A ausência do dado nunca inventa estado.
 */

export type UserDisplayStatus = "active" | "inactive" | "invite_pending" | "invite_expired"

/** Projeção mínima do schema `auth` que atravessa para o produto. */
export interface InviteFacts {
  invited_at?: string | null
  confirmed_at?: string | null
}

/** O que a derivação precisa saber: a coluna do produto + os fatos do Auth. */
export interface DerivableUser extends InviteFacts {
  status: string
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Precedência EXATA do AC2, nesta ordem:
 *   1. `status = 'inactive'`            → "Desativado"
 *   2. convite não aceito e vencido     → "Convite expirado"
 *   3. convite não aceito               → "Convite pendente"
 *   4. resto                            → "Ativo"
 *
 * "Desativado" vence tudo de propósito: quem foi desativado pelo admin está
 * desativado, mesmo que nunca tenha aceitado o convite. Inverter essa ordem
 * esconderia uma decisão explícita do admin atrás de um estado derivado.
 */
export function deriveUserDisplayStatus(
  user: DerivableUser,
  now: Date | number = Date.now(),
): UserDisplayStatus {
  if (user.status === "inactive") return "inactive"

  const confirmedAt = parseTimestamp(user.confirmed_at)
  if (confirmedAt !== null) return "active"

  const invitedAt = parseTimestamp(user.invited_at)
  // Sem `invited_at` não existe convite a representar: ou a pessoa entrou por
  // outro caminho (OAuth/SAML, criação direta), ou o Auth não respondeu (AC9).
  if (invitedAt === null) return "active"

  const nowMs = typeof now === "number" ? now : now.getTime()
  return nowMs > invitedAt + INVITE_TTL_MS ? "invite_expired" : "invite_pending"
}

/** Os dois estados em que reenviar/revogar convite fazem sentido (AC4, AC5). */
export function isPendingInvite(status: UserDisplayStatus): boolean {
  return status === "invite_pending" || status === "invite_expired"
}

export const USER_DISPLAY_STATUS_LABEL: Record<UserDisplayStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  invite_pending: "Convite pendente",
  invite_expired: "Convite expirado",
}

/** Variantes do `Badge` de `@eximia/ui`, mantidas fora do componente para teste. */
export const USER_DISPLAY_STATUS_VARIANT: Record<
  UserDisplayStatus,
  "success" | "error" | "warning" | "info"
> = {
  active: "success",
  inactive: "error",
  invite_pending: "info",
  invite_expired: "warning",
}
