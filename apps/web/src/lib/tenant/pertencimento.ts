import { hostCanonico } from "./resolver"
import type { OrigemDoTenant } from "./tipos"

// ===========================================================================
// HOST × USUÁRIO DIVERGEM (D3)
//
// Regra, na íntegra: se a pessoa alcança o tenant do host — por
// `users.tenant_id` OU por uma linha em `user_tenant_memberships` —, serve
// normalmente. Senão, ela é mandada para o host canônico do PRÓPRIO tenant
// primário. `super_admin` serve em qualquer host.
//
// ISTO NÃO É AUTORIZAÇÃO, E A DISTINÇÃO IMPORTA. O redirecionamento existe
// para a pessoa não ver a marca da empresa A enquanto lê os dados da empresa
// B — que é o que aconteceria sem ele, porque a RLS (a trava de verdade)
// entrega os dados DELA independentemente do endereço digitado. Ninguém ganha
// acesso por estar no host certo, e ninguém perde por estar no errado: perde
// só a coerência visual, e é ela que se conserta aqui.
// ===========================================================================

/**
 * Origens em que NÃO há para onde mandar ninguém.
 *
 * `env-legado` é o serviço de um cliente só: ali o host não distingue nada e
 * `{slug}.{base}` pode nem existir. `dev` são os atalhos `?tenant=` e
 * `{slug}.localhost`, que também não têm host canônico.
 *
 * As outras três — `dominio-proprio`, `subdominio` e `neutro` — SÃO endereços
 * do domínio da plataforma, e nas três a marca exibida pode divergir da pessoa.
 */
const ORIGENS_SEM_DESTINO: ReadonlySet<OrigemDoTenant> = new Set<OrigemDoTenant>([
  "env-legado",
  "dev",
])

/** O host está dentro do domínio da plataforma (o ápice ou um subdomínio dele)? */
function dentroDoDominioDaPlataforma(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`)
}

export interface EntradaDaDecisao {
  /**
   * Tenant que o HOST resolveu. `null` = host neutro — que NÃO é sinônimo de
   * "nada a fazer": ver o ramo neutro em `hostDeDestinoD3`.
   */
  tenantDoHost: string | null
  origem: OrigemDoTenant
  /** Chapéus reais (união de `user_roles`). */
  chapeus: readonly string[]
  /** `users.tenant_id` da pessoa. `null` para super_admin e para quem não tem. */
  tenantDoUsuario: string | null
  /** Slug do tenant primário da pessoa, para montar o destino. */
  slugDoUsuario: string | null
  /** Existe linha em `user_tenant_memberships` para (pessoa, tenant do host). */
  temMembership: boolean
  /** Host normalizado desta requisição, para nunca redirecionar para si mesmo. */
  hostAtual: string
  /** `NEXT_PUBLIC_APP_BASE_DOMAIN`. Sem ele não há destino para onde mandar. */
  base?: string
}

/**
 * O host para onde redirecionar, ou `null` para servir aqui mesmo.
 *
 * Função pura de propósito: a regra da D3 é o que precisa de teste, e ela não
 * depende de como as três leituras foram feitas.
 */
export function hostDeDestinoD3(entrada: EntradaDaDecisao): string | null {
  const { tenantDoHost, origem, chapeus, tenantDoUsuario, slugDoUsuario, temMembership } = entrada

  // Modo legado (um serviço por cliente) e atalhos de dev: o host não carrega
  // identidade, então `{slug}.{base}` pode nem existir. Servir onde está.
  if (ORIGENS_SEM_DESTINO.has(origem)) return null

  // super_admin serve em qualquer host (D3). A marca que ele VÊ é a do tenant
  // ativo (`x-sa-active-tenant`), resolvida em `lib/tenant.ts` — aqui só se
  // decide se ele fica, e ele fica.
  if (chapeus.includes("super_admin")) return null

  if (tenantDoHost) {
    // Alcança o tenant do host: por coluna ou por membership.
    if (tenantDoUsuario === tenantDoHost) return null
    if (temMembership) return null
  } else {
    // HOST NEUTRO DENTRO DO DOMÍNIO DA PLATAFORMA.
    //
    // O ápice (`{base}`), `www.{base}` (rótulo reservado, D5) e qualquer typo
    // de subdomínio (`acdemy.{base}`) resolvem para NEUTRO — e num wildcard
    // DNS `*.{base}` os três são endereços alcançáveis por qualquer pessoa.
    // Servir ali entrega o app inteiro com a marca eximIA e os módulos do
    // NEUTRO para o admin de uma empresa real: a RLS continua devolvendo os
    // dados DELE (correto), mas vestidos com a marca de outra companhia — que
    // é literalmente a incoerência que a D3 existe para consertar. Deixar de
    // fora só porque `tenantId` é `null` seria conservar o defeito.
    //
    // Fora do domínio base NÃO se redireciona: um host desconhecido pode ser
    // `localhost`, um IP de healthcheck, ou o domínio próprio de um cliente no
    // meio da virada de DNS — mandar essas requisições para outro endereço
    // troca uma tela de marca errada por uma navegação quebrada.
    if (!entrada.base) return null
    if (!dentroDoDominioDaPlataforma(entrada.hostAtual, entrada.base)) return null
  }

  // Não alcança. Só há para onde mandar se ela tiver um tenant primário COM
  // slug e o domínio base estiver configurado. Sem isso, servir onde está é
  // melhor do que redirecionar para um endereço inventado.
  if (!slugDoUsuario || !entrada.base) return null
  const destino = hostCanonico(slugDoUsuario, entrada.base)
  if (!destino) return null
  // Destino == origem seria laço de redirecionamento infinito. Acontece quando
  // o host JÁ é o canônico da pessoa mas o tenant do host resolveu para outro
  // id (linha de `tenants` removida, slug reciclado). Servir é o menos pior.
  if (destino === entrada.hostAtual) return null
  return destino
}
