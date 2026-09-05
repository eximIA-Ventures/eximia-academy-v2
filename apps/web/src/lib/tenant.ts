import type { TenantConfig } from "@eximia/shared"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { NEUTRO, configDoAmbiente } from "../../tenant.config"
import { COLUNAS_DE_MARCA, type LinhaDeTenant, montarConfigDoTenant } from "./tenant/marca"
import { hostDaRequisicao, resolverTenantDaRequisicao } from "./tenant/resolver"
import type { OrigemDoTenant, TenantContexto } from "./tenant/tipos"

// ===========================================================================
// A MARCA DESTA REQUISIÇÃO
//
// POR QUE ESTA FUNÇÃO VIROU `async`
// ----------------------------------
// Ela era `return tenantConfig` — um import estático de `tenant.config.ts`,
// resolvido em BUILD. Enquanto a identidade do cliente fosse literal dentro do
// artefato, dar marca diferente a clientes diferentes exigia dar ARTEFATO
// diferente: uma branch `deploy/{cliente}` ou 16 `ARG`/`ENV` de marca no
// Dockerfile, e um serviço por empresa. A marca saiu do build e virou dado:
// o middleware resolve a empresa pelo HOST e escreve `x-tenant-id`; aqui se lê
// esse cabeçalho e se busca a linha de `tenants`. Um artefato, N empresas.
//
// `cache()` do React é o MESMO padrão de `getAuthProfile` (`lib/auth.ts:13`):
// deduplica a leitura entre layout e página do mesmo render. Não é cache entre
// requisições — uma edição de marca aparece no próximo request, não em 60s.
//
// ORDEM DE FALLBACK (D4): banco -> env (`NEXT_PUBLIC_TENANT_*`, modo legado)
// -> NEUTRO. Cada camada mescla campo a campo sobre a de baixo, porque
// `tenants.brand` pode ser parcial.
//
// `customCSS` NUNCA vem do banco (D4) — ver `lib/tenant/marca.ts`.
// ===========================================================================

/** Cabeçalhos da requisição, ou `null` fora de escopo de requisição. */
async function cabecalhos(): Promise<Headers | null> {
  try {
    return await headers()
  } catch {
    // `headers()` lança em geração estática. Quem consome marca declara
    // `dynamic = "force-dynamic"` (D17); este catch é a rede embaixo disso.
    return null
  }
}

const ORIGENS: readonly OrigemDoTenant[] = [
  "dominio-proprio",
  "subdominio",
  "env-legado",
  "dev",
  "neutro",
]

function origemDoHeader(bruto: string | null, temTenant: boolean): OrigemDoTenant {
  const achada = ORIGENS.find((o) => o === bruto)
  if (achada) return achada
  return temTenant ? "subdominio" : "neutro"
}

/**
 * Quem é a empresa desta requisição: `{tenantId, slug, isNeutro, host}`.
 *
 * A fonte normal são os cabeçalhos `x-tenant-*` que o middleware escreveu (e
 * que ele apaga da entrada antes, para o cliente não os forjar). Se eles não
 * vierem — rota fora do `matcher`, chamada interna —, resolve-se aqui pelo
 * mesmo caminho, que é memoizado por host e sai barato.
 */
export const getTenantContext = cache(async (): Promise<TenantContexto> => {
  const h = await cabecalhos()
  if (!h) {
    return { tenantId: null, slug: NEUTRO.brand.slug, isNeutro: true, host: "", origem: "neutro" }
  }

  const idDoHeader = h.get("x-tenant-id")
  const slugDoHeader = h.get("x-tenant-slug")
  if (slugDoHeader) {
    return {
      tenantId: idDoHeader || null,
      slug: slugDoHeader,
      isNeutro: !idDoHeader,
      host: hostDaRequisicao(h),
      // A origem viaja num terceiro cabeçalho porque ela não é derivável do par
      // (id, slug): `dominio-proprio` e `subdominio` produzem exatamente o mesmo
      // par, e a D3 trata os dois igual mas o modo legado não.
      origem: origemDoHeader(h.get("x-tenant-origem"), Boolean(idDoHeader)),
    }
  }

  return resolverTenantDaRequisicao(h)
})

/**
 * O tenant cuja MARCA deve ser pintada.
 *
 * Igual ao do host, exceto para o `super_admin`: ele serve em qualquer host
 * (D3) e opera sobre a empresa escolhida no seletor (`x-sa-active-tenant`), de
 * modo que a tela tem que vestir a marca DELA — senão ele edita a empresa A
 * lendo o logo da B.
 *
 * O chapéu só é verificado quando o cookie EXISTE. Isso não é economia: o
 * cookie é um palpite de UI e qualquer visitante pode escrevê-lo, então ele
 * precisa de confirmação. Como quase ninguém o tem, quase ninguém paga a
 * confirmação — e a tela de login anônima não paga nada.
 */
async function tenantDaMarca(contexto: TenantContexto): Promise<string | null> {
  let cookieAtivo: string | undefined
  try {
    cookieAtivo = (await cookies()).get("x-sa-active-tenant")?.value
  } catch {
    cookieAtivo = undefined
  }
  if (!cookieAtivo) return contexto.tenantId

  const { getAuthProfile } = await import("@/lib/auth")
  const perfil = await getAuthProfile()
  // `roles` defensivamente normalizado: esta função é chamada de dentro de
  // loaders que rodam sob mocks parciais de `getAuthProfile`, e a marca da
  // página não pode quebrar porque o perfil veio sem a união de chapéus.
  const chapeus: string[] = Array.isArray(perfil.roles) ? perfil.roles : []
  const ehSuperAdmin = chapeus.includes("super_admin") || perfil.profile?.role === "super_admin"
  // Fallback explícito para a marca do HOST (D3) quando quem tem o cookie não
  // é super_admin — o cookie sozinho nunca troca a marca de ninguém.
  return ehSuperAdmin ? cookieAtivo : contexto.tenantId
}

async function lerLinhaDoTenant(tenantId: string): Promise<LinhaDeTenant | null> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const db = createServiceClient()
    const { data, error } = await db
      .from("tenants")
      .select(COLUNAS_DE_MARCA)
      .eq("id", tenantId)
      .maybeSingle()
    if (error || !data) return null
    return data as unknown as LinhaDeTenant
  } catch (e) {
    // Banco fora do ar degrada para env/NEUTRO. Derrubar a página por causa da
    // cor do cabeçalho seria trocar "marca errada" por "site fora".
    console.warn("[tenant] falha ao ler a marca do banco:", e)
    return null
  }
}

/**
 * A `TenantConfig` desta requisição. `await` obrigatório — sem ele o retorno é
 * uma `Promise` e a UI lê `undefined` em silêncio (por isso existe o teste de
 * fonte `getTenantConfig` sem `await` em `src/__tests__/`).
 */
export const getTenantConfig = cache(async (): Promise<TenantConfig> => {
  const contexto = await getTenantContext()
  const base = configDoAmbiente()

  const tenantId = await tenantDaMarca(contexto)
  if (!tenantId) return base

  return montarConfigDoTenant(await lerLinhaDoTenant(tenantId), base)
})

export { NEUTRO }
export type { TenantContexto }
