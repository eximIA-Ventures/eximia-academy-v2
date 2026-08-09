import { type InviteFacts, deriveUserDisplayStatus, isPendingInvite } from "@/lib/invites/status"

/**
 * Os filtros e resoluções de coluna da tela de Usuários (CFG-6.1, AC1/AC2/AC8),
 * como funções PURAS.
 *
 * Existem duas leituras da MESMA lista: `loader.ts` (a primeira página, SSR) e
 * `api/admin/users/route.ts` (o "Carregar mais"). Se cada uma implementasse a
 * busca por cargo, o filtro por estado e a resolução de Área do seu jeito, a
 * página 2 mostraria colunas e conjunto diferentes da página 1 — foi exatamente
 * assim que a cópia de `listUsers` da rota ficou para trás antes da CFG-2.3.
 * Aqui a regra mora uma vez só, sem nenhum import de servidor, e por isso é
 * testável sem banco.
 */

/* ----------------------------- Busca por cargo ---------------------------- */

/**
 * Ids dos cargos do tenant cujo NOME casa com a busca (AC1).
 *
 * A busca da tela é uma só ("nome, email ou cargo"), mas `job_role_id` é uma FK:
 * não dá para fazer `ilike` nela. Como os cargos do tenant já vêm carregados
 * para o `<select>` da ficha, o casamento acontece em memória e vira um
 * `job_role_id.in.(...)` dentro do mesmo `.or()` — sem join, sem query extra.
 *
 * Devolve `[]` quando nada casa: o chamador deve então NÃO acrescentar a
 * cláusula (um `in.()` vazio é sintaxe inválida no PostgREST).
 */
export function jobRoleIdsMatching(
  jobRoles: { id: string; name: string }[],
  search: string,
): string[] {
  const needle = search.trim().toLowerCase()
  if (!needle) return []
  return jobRoles.filter((jr) => jr.name.toLowerCase().includes(needle)).map((jr) => jr.id)
}

/* -------------------------- Filtro por estado ----------------------------- */

/**
 * Os estados FILTRÁVEIS pelos cards do topo (AC8).
 *
 * `invite_pending` aqui significa "pendente OU expirado", igual ao que o card
 * "Convites pendentes" conta (`loader.ts`, via `isPendingInvite`). Um filtro que
 * devolvesse conjunto menor que o número clicado seria pior que não filtrar.
 */
export type DisplayStatusFilter = "active" | "inactive" | "invite_pending"

const DISPLAY_STATUS_FILTERS: DisplayStatusFilter[] = ["active", "inactive", "invite_pending"]

export const DISPLAY_STATUS_FILTER_LABEL: Record<DisplayStatusFilter, string> = {
  active: "Ativos",
  inactive: "Desativados",
  invite_pending: "Convites pendentes",
}

/** Aceita só os três valores acima; qualquer outra coisa vira "sem filtro". */
export function parseDisplayStatusFilter(value: unknown): DisplayStatusFilter | null {
  if (typeof value !== "string") return null
  return DISPLAY_STATUS_FILTERS.includes(value as DisplayStatusFilter)
    ? (value as DisplayStatusFilter)
    : null
}

/**
 * Ids do censo que casam com o estado EXIBIDO pedido (AC8).
 *
 * O estado exibido é DERIVADO (`lib/invites/status.ts`) — "Convite pendente" não
 * existe em `users.status` e nunca vai existir. Logo o filtro também precisa ser
 * derivado: não há `WHERE` que o expresse. O caminho é o mesmo já usado pelo
 * filtro de área: derivar em memória sobre o censo do tenant e restringir a
 * query com `.in("id", ...)`.
 *
 * Devolve `null` quando o filtro NÃO PODE ser honrado — censo ausente, ou estado
 * de convite pedido sem os fatos do Auth. Filtrar no escuro devolveria uma lista
 * plausível e errada; o chamador deve tratar `null` como "não sei", nunca como
 * "ninguém".
 */
export function idsMatchingDisplayStatus(
  roster: { id: string; status: string }[] | null,
  facts: Record<string, InviteFacts>,
  filter: DisplayStatusFilter,
  now: Date | number = Date.now(),
): string[] | null {
  if (!roster) return null

  const authAvailable = Object.keys(facts).length > 0
  // Sem fatos do Auth, "Ativo" cai no par binário e "pendente" não existe: o
  // primeiro ainda é respondível, o segundo não.
  if (!authAvailable && filter === "invite_pending") return null

  return roster
    .filter((row) => {
      const derived = deriveUserDisplayStatus(
        {
          status: row.status,
          invited_at: facts[row.id]?.invited_at ?? null,
          confirmed_at: facts[row.id]?.confirmed_at ?? null,
        },
        now,
      )
      return filter === "invite_pending" ? isPendingInvite(derived) : derived === filter
    })
    .map((row) => row.id)
}

/* ---------------------------- Coluna "Área" ------------------------------- */

/**
 * Nomes de área por usuário (AC2).
 *
 * `areas` já chega limitado ao tenant do chamador, e o mapa é montado SÓ com ids
 * conhecidos: um vínculo apontando para área de outro tenant (dado sujo) é
 * descartado em vez de virar um nome na tela. Ordena por nome para a coluna não
 * dançar entre renderizações.
 */
export function areaNamesByUser(
  memberships: { user_id: string; area_id: string }[] | null,
  areas: { id: string; name: string }[],
): Record<string, string[]> {
  const nameById = new Map(areas.map((a) => [a.id, a.name]))
  const out: Record<string, string[]> = {}

  for (const link of memberships ?? []) {
    const name = nameById.get(link.area_id)
    if (!name) continue
    const list = out[link.user_id] ?? []
    if (!list.includes(name)) list.push(name)
    out[link.user_id] = list
  }

  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }

  return out
}

/**
 * Ids de área por usuário — o que o "Mover de área" precisa saber para REMOVER o
 * vínculo antigo antes de criar o novo (AC6). Sem isso, mover viraria acumular.
 */
export function areaIdsByUser(
  memberships: { user_id: string; area_id: string }[] | null,
  areas: { id: string; name: string }[],
): Record<string, string[]> {
  const known = new Set(areas.map((a) => a.id))
  const out: Record<string, string[]> = {}

  for (const link of memberships ?? []) {
    if (!known.has(link.area_id)) continue
    const list = out[link.user_id] ?? []
    if (!list.includes(link.area_id)) list.push(link.area_id)
    out[link.user_id] = list
  }

  return out
}
