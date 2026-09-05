/**
 * Listas de papéis das rotas que produzem/administram CONTEÚDO, para uso com
 * `requireRole` (`lib/api-role-guard.ts`).
 *
 * Vive fora do `api-role-guard.ts` de propósito: aquele arquivo é o guard
 * compartilhado da casa e estava sendo editado por outra frente na mesma rodada
 * (FIX-B2, 2026-08-30). Três mãos no mesmo arquivo produzem um estado que
 * ninguém consegue interpretar; uma constante nova ao lado não produz nenhum.
 *
 * A razão de existirem é a mesma de `PAPEIS_COURSE_DESIGNER`: eram a mesma
 * literal repetida em doze rotas. Um papel novo agora entra em um lugar.
 */

/**
 * Quem pode ingerir e transformar material em curso: as 8 rotas de
 * `api/ingestion/**`, mais `api/courses/import` e `api/blueprint/generate`.
 *
 * NOTA sobre `super_admin`, que NÃO está aqui: nenhuma das dez rotas o aceitava
 * antes desta correção. Adicioná-lo agora seria alargar o direito de acesso a
 * pretexto de arrumar tratamento de erro — mudança de política escondida dentro
 * de um fix. Se a casa quiser incluí-lo, que seja uma decisão própria, com seu
 * próprio teste.
 */
export const PAPEIS_CONTEUDO = ["manager", "admin", "instructor"] as const

/** Quem administra chaves de integração (`api/integrations/keys`). */
export const PAPEIS_CHAVES_INTEGRACAO = ["admin", "super_admin"] as const
