/**
 * Contratos da seção Cargos (CFG-3.1).
 *
 * Vivem FORA de `actions.ts` de propósito: aquele módulo é `"use server"`, onde
 * todo export vira uma server action. Tipo aqui é tipo, não endpoint.
 */

export interface JobRoleTrail {
  id: string
  title: string
  /** `draft` | `active` | `archived` — só `active` conta para governança. */
  status: string
}

export interface JobRolePerson {
  id: string
  full_name: string | null
  email: string
  /**
   * SEM `avatar_url` de propósito. A coluna é declarada em
   * `packages/database/src/schema/users.ts` mas nenhuma migration jamais a criou
   * no banco; pedi-la faz o PostgREST recusar a consulta inteira (`42703`) e a
   * lista de pessoas voltar vazia. Decisão do dono (2026-07-28): remover do
   * código, não criar a coluna — não há uma foto sequer em produção e o avatar
   * já cai na inicial do nome. Se um dia houver foto de verdade, a coluna vem
   * por migration ANTES de qualquer select voltar a pedi-la.
   */
  /** Áreas da pessoa (vínculo N:N via `user_areas`), não a área do cargo. */
  area_names: string[]
}

export interface JobRoleWithStats {
  id: string
  name: string
  slug: string
  description: string | null
  seniority_level: string
  area_id: string | null
  created_at: string
  area_name: string | null
  /** Contagem de trilhas ATIVAS (mantida: é o que o dot de governança usa). */
  active_trails_count: number
  /** Trilhas vinculadas ao cargo, por NOME (todas as situações). */
  trails: JobRoleTrail[]
  /** Pessoas cujo `users.job_role_id` aponta para este cargo. */
  people: JobRolePerson[]
}

export interface TenantTrail {
  id: string
  title: string
  status: string
  /** Cargo que já é dono da trilha (vínculo 1:1 hoje). */
  target_job_role_id: string | null
}

export interface JobRoleArea {
  id: string
  name: string
}

/**
 * Destino de UMA pessoa na reatribuição que precede a exclusão do cargo (AC8).
 * `null` é a escolha explícita "fica sem cargo" — nunca o default silencioso.
 */
export interface JobRoleReassignment {
  userId: string
  targetJobRoleId: string | null
}
