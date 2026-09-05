/**
 * Os tipos da resolução de tenant por requisição (D2).
 *
 * Arquivo separado do resolvedor porque o middleware, `lib/tenant.ts` e os
 * consumidores de `getTenantContext()` importam só o TIPO — e um import de
 * tipo que arrasta junto o cliente de serviço do Supabase seria custo puro.
 */

/**
 * De onde veio a resposta. Não é decoração: a D3 (host × usuário divergem) só
 * pode redirecionar quando o host CARREGA a identidade da empresa
 * (`dominio-proprio`, `subdominio`). No modo legado há um serviço por cliente e
 * o host não distingue nada — mandar alguém para `{slug}.{base}` a partir dali
 * seria expulsá-lo para um endereço que talvez nem exista.
 */
export type OrigemDoTenant =
  /** `tenant_domains.host` — domínio próprio da empresa. */
  | "dominio-proprio"
  /** `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}`, derivado por string. */
  | "subdominio"
  /** `NEXT_PUBLIC_TENANT_SLUG` — um serviço por cliente (D2, passo 3). */
  | "env-legado"
  /** `?tenant=slug` ou `*.localhost` — SÓ fora de produção. */
  | "dev"
  /** Nenhuma empresa. `tenantId` é `null`, nunca uma linha de `tenants`. */
  | "neutro"

export interface TenantContexto {
  /** `null` quando neutro. NUNCA o id de um tenant "parecido". */
  tenantId: string | null
  /** `__neutro__` quando neutro (D5). */
  slug: string
  isNeutro: boolean
  /** Host normalizado que produziu esta resolução (minúsculo, sem porta). */
  host: string
  origem: OrigemDoTenant
}

/** A linha mínima de `tenants` que a resolução precisa. */
export interface TenantIdentificado {
  id: string
  slug: string
}

/**
 * De onde o resolvedor lê. Existe para os testes rodarem SEM banco: o
 * middleware passa a implementação de service client, o teste passa um stub
 * com duas tabelas em memória.
 */
export interface FonteDeTenants {
  /** `tenant_domains.host` — a ÚNICA leitura de banco por host (D2, passo 1). */
  porHost(host: string): Promise<TenantIdentificado | null>
  /** `tenants.slug` — depois do slug já ter sido derivado por string. */
  porSlug(slug: string): Promise<TenantIdentificado | null>
}
