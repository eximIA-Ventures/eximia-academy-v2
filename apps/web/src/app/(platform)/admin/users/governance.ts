import { type InviteFacts, deriveUserDisplayStatus } from "@/lib/invites/status"

/**
 * O sinal âmbar de atenção da lista de Usuários (CFG-6.1, rodada de fidelidade).
 *
 * É o ÚNICO aviso proativo da tela: em vez de o admin ter que conferir pessoa a
 * pessoa quem ficou sem vínculo, a linha levanta a mão sozinha. Três motivos,
 * todos acionáveis pelo próprio drawer que já existe:
 *   - sem área,
 *   - sem cargo,
 *   - convite parado (mandado e nunca aceito, passado o prazo).
 *
 * ## Por que o prazo NÃO é um `7` escrito aqui
 *
 * "Parado há 7+ dias" é exatamente a fronteira que `INVITE_TTL_DAYS` já define, e
 * que `deriveUserDisplayStatus` já aplica ao devolver `invite_expired`. Repetir o
 * número aqui criaria dois lugares para mudá-lo — e o dia em que um mudasse sem o
 * outro, a pílula diria "Convite pendente" enquanto o ponto âmbar diria
 * "parado". Reusar a derivação mantém pílula e sinal falando a mesma coisa por
 * construção.
 *
 * ## Quem NÃO acende
 *
 * Pessoa desativada. Ela não tem área nem cargo por decisão do admin, e cobrar
 * vínculo de quem foi desligado é ruído puro: o sinal perde credibilidade se
 * apontar para coisas que ninguém vai agir.
 */

export interface GovernanceSubject extends InviteFacts {
  status: string
  job_role_id?: string | null
  area_ids?: string[]
}

/**
 * Motivos de atenção, em ordem de leitura. Lista vazia = nada a sinalizar.
 * Devolver a lista (e não um booleano) é o que permite ao `title` dizer POR QUE,
 * que é a diferença entre um alerta útil e uma bolinha decorativa.
 */
export function governanceReasons(
  user: GovernanceSubject,
  now: Date | number = Date.now(),
): string[] {
  if (user.status !== "active") return []

  const reasons: string[] = []

  if (!user.area_ids || user.area_ids.length === 0) {
    reasons.push("sem área")
  }
  if (!user.job_role_id) {
    reasons.push("sem cargo")
  }
  if (deriveUserDisplayStatus(user, now) === "invite_expired") {
    reasons.push("convite parado há mais de 7 dias")
  }

  return reasons
}

/** O texto do `title`, já pronto para a UI. `null` quando não há o que sinalizar. */
export function governanceTitle(
  user: GovernanceSubject,
  now: Date | number = Date.now(),
): string | null {
  const reasons = governanceReasons(user, now)
  if (reasons.length === 0) return null
  return `Precisa de atenção: ${reasons.join(", ")}.`
}
