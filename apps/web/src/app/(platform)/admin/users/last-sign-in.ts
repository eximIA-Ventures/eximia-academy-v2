import { fetchAuthAccounts } from "./auth-accounts"

/**
 * "Último acesso" real (CFG-2.3).
 *
 * A varredura paginada de `auth.admin.listUsers` que morava aqui foi promovida a
 * `auth-accounts.ts` pela CFG-2.2: "último acesso" e "estado do convite" saem do
 * MESMO objeto, na MESMA resposta, e não faria sentido pagar duas varreduras
 * paginadas contra o Auth pelo mesmo payload. Este módulo continua existindo
 * como a projeção mais estreita possível daquele acessor — o contrato público
 * (assinatura, mapa id → data, mapa vazio em caso de falha, least privilege) é
 * o mesmo de antes, byte a byte no que o chamador enxerga.
 *
 * Todo o raciocínio (por que não é `.in("id", ids)` no schema `auth`, por que a
 * paginação tem teto, por que a falha é silenciosa) está em `auth-accounts.ts`.
 */

/** Fronteira tipada: o resto do app nunca vê o objeto cru do schema `auth`. */
export type LastSignInMap = Record<string, string | null>

export async function fetchLastSignInAt(userIds: string[]): Promise<LastSignInMap> {
  const accounts = await fetchAuthAccounts(userIds)

  const map: LastSignInMap = {}
  for (const [id, facts] of Object.entries(accounts)) {
    map[id] = facts.last_sign_in_at
  }
  return map
}
