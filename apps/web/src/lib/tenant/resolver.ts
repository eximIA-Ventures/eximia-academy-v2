import {
  NEUTRO,
  dominioBase,
  ehSlugReservado,
  instanciaDaPlataforma,
  slugDoAmbiente,
} from "../../../tenant.config"
import { gravarNoCache, lerDoCache } from "./cache"
import type { FonteDeTenants, TenantContexto, TenantIdentificado } from "./tipos"

// ===========================================================================
// QUEM É A EMPRESA DESTA REQUISIÇÃO (D1/D2)
//
// O host NUNCA autoriza nada. Ele só diz QUAL MARCA e QUAL EMPRESA a tela
// deve exibir; o que cada pessoa pode LER continua sendo decidido pela RLS do
// Supabase, com o JWT dela. Resolver o tenant errado aqui pinta a tela errada
// — não abre dado de ninguém. É por isso que a resposta segura para "não sei"
// é NEUTRO, e não "o de sempre".
//
// A ordem (D2), sem atalho:
//   1. `tenant_domains.host`  — domínio próprio. ÚNICA leitura obrigatória.
//   2. subdomínio de `NEXT_PUBLIC_APP_BASE_DOMAIN` — slug derivado por STRING,
//      sem banco; o banco só entra para converter slug -> id.
//   3. `NEXT_PUBLIC_TENANT_SLUG` — modo legado, um serviço por cliente.
//   4. NEUTRO, com `tenantId = null`.
//
// Fora de produção entram dois atalhos, e só lá: `?tenant=slug` e
// `{slug}.localhost`. Nenhum dos dois existe em produção — `?tenant=` num
// serviço real seria um trocador de marca por query string, à disposição de
// qualquer visitante.
// ===========================================================================

/** Slug de empresa: o MESMO `^[a-z0-9-]{1,50}$` que `provisionar_tenant` valida. */
const SLUG_RE = /^[a-z0-9-]{1,50}$/

/**
 * Host normalizado: minúsculo, sem porta, sem ponto final, sem lista de proxy.
 *
 * `x-forwarded-host` vem na frente porque em produção quem fala com o Next é o
 * Traefik: o `host` ali é o do container, não o que o navegador pediu. Os dois
 * são cabeçalhos de rede e podem ser forjados — e é exatamente por isso que o
 * resultado disto não concede permissão nenhuma (ver cabeçalho).
 */
export function normalizarHost(bruto: string | null | undefined): string {
  if (!bruto) return ""
  // `x-forwarded-host` pode chegar como "a.com, b.com" quando há mais de um
  // proxy. O PRIMEIRO é o que o cliente pediu; os demais são saltos internos.
  const primeiro = bruto.split(",")[0]?.trim().toLowerCase() ?? ""
  if (primeiro === "") return ""

  // IPv6 literal (`[::1]:3000`): a porta é o que vem DEPOIS do `]`.
  const semPorta = primeiro.startsWith("[")
    ? primeiro.slice(0, primeiro.indexOf("]") + 1)
    : (primeiro.split(":")[0] ?? "")

  // FQDN com ponto final ("exemplo.com.") é o mesmo host que sem.
  return semPorta.replace(/\.$/, "")
}

/** O host da requisição, já normalizado. */
export function hostDaRequisicao(cabecalhos: Headers): string {
  return normalizarHost(cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"))
}

/**
 * O slug embutido num subdomínio de `base`, por STRING (D1) — sem banco.
 *
 * Devolve `null` quando o host não é subdomínio de `base`, quando o rótulo tem
 * ponto (`a.b.base` não é empresa nenhuma) ou quando o rótulo é reservado.
 */
export function slugDoSubdominio(host: string, base: string | undefined): string | null {
  if (!host || !base) return null
  const sufixo = `.${base}`
  if (!host.endsWith(sufixo)) return null
  const rotulo = host.slice(0, -sufixo.length)
  if (!SLUG_RE.test(rotulo)) return null
  if (ehSlugReservado(rotulo)) return null
  return rotulo
}

/** `{slug}.localhost` — atalho de desenvolvimento, nunca em produção. */
function slugDoLocalhost(host: string): string | null {
  if (!host.endsWith(".localhost")) return null
  const rotulo = host.slice(0, -".localhost".length)
  if (!SLUG_RE.test(rotulo)) return null
  if (ehSlugReservado(rotulo)) return null
  return rotulo
}

export function contextoNeutro(host: string): TenantContexto {
  return {
    tenantId: null,
    slug: NEUTRO.brand.slug,
    isNeutro: true,
    host,
    origem: "neutro",
    // A instância é a camada de FORA do tenant: ela existe mesmo quando não há
    // empresa nenhuma resolvida — é justamente ela quem dá a marca da porta de
    // entrada (`app.{base}`) desta instalação.
    instancia: instanciaDaPlataforma(),
  }
}

function contexto(
  tenant: TenantIdentificado,
  host: string,
  origem: TenantContexto["origem"],
): TenantContexto {
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    isNeutro: false,
    host,
    origem,
    instancia: instanciaDaPlataforma(),
  }
}

/** Leitura memoizada por host. `null` cacheado = "não é domínio próprio". */
async function porHostComCache(
  fonte: FonteDeTenants,
  host: string,
): Promise<TenantIdentificado | null> {
  const chave = `host:${host}`
  const emCache = lerDoCache(chave)
  if (emCache !== undefined) return emCache
  const achado = await fonte.porHost(host)
  gravarNoCache(chave, achado)
  return achado
}

/** Idem para slug -> id. O slug já veio por string; isto só busca o id. */
async function porSlugComCache(
  fonte: FonteDeTenants,
  slug: string,
): Promise<TenantIdentificado | null> {
  const chave = `slug:${slug}`
  const emCache = lerDoCache(chave)
  if (emCache !== undefined) return emCache
  const achado = await fonte.porSlug(slug)
  gravarNoCache(chave, achado)
  return achado
}

export interface OpcoesDeResolucao {
  fonte: FonteDeTenants
  /** `NEXT_PUBLIC_APP_BASE_DOMAIN`. Ausente => o passo 2 não existe. */
  base?: string
  /** `NEXT_PUBLIC_TENANT_SLUG`. Ausente => o passo 3 não existe. */
  slugLegado?: string
  /** `?tenant=` da URL. Só é olhado fora de produção. */
  slugDaQuery?: string | null
  /** `NODE_ENV !== "production"`. */
  ehDesenvolvimento?: boolean
}

/**
 * A implementação da ordem da D2. Pura em relação a env e banco: tudo entra
 * por `opcoes`, para o teste rodar sem processo e sem Postgres.
 */
export async function resolverTenantPorHost(
  hostBruto: string,
  opcoes: OpcoesDeResolucao,
): Promise<TenantContexto> {
  const host = normalizarHost(hostBruto)
  const { fonte, base, slugLegado, slugDaQuery, ehDesenvolvimento = false } = opcoes

  // --- Atalhos de desenvolvimento (nunca em produção) --------------------
  if (ehDesenvolvimento) {
    const slugDev = (slugDaQuery ?? "").trim().toLowerCase() || slugDoLocalhost(host)
    if (slugDev && SLUG_RE.test(slugDev) && !ehSlugReservado(slugDev)) {
      const achado = await porSlugComCache(fonte, slugDev)
      if (achado) return contexto(achado, host, "dev")
      // Slug inexistente em dev NÃO cai no legado: quem escreveu `?tenant=x`
      // quis `x`, e servir a marca de outra empresa esconderia o erro.
      return contextoNeutro(host)
    }
  }

  // --- 1. Domínio próprio --------------------------------------------------
  if (host) {
    const proprio = await porHostComCache(fonte, host)
    if (proprio) return contexto(proprio, host, "dominio-proprio")
  }

  // --- 2. Subdomínio do domínio base, por string --------------------------
  const slug = slugDoSubdominio(host, base)
  if (slug) {
    const achado = await porSlugComCache(fonte, slug)
    if (achado) return contexto(achado, host, "subdominio")
    // Subdomínio que não casa com empresa nenhuma é host DESCONHECIDO. Cair no
    // modo legado aqui serviria a marca do cliente do serviço para
    // `qualquer-coisa.{base}` — o defeito que a D2 existe para impedir.
    return contextoNeutro(host)
  }

  // --- 3. Modo legado: um serviço por cliente ------------------------------
  const legado = (slugLegado ?? "").trim().toLowerCase()
  if (legado && !ehSlugReservado(legado)) {
    const achado = await porSlugComCache(fonte, legado)
    if (achado) return contexto(achado, host, "env-legado")
    // Env aponta para uma empresa que não existe no banco: NEUTRO. O
    // `configDoAmbiente()` ainda pinta a marca em `lib/tenant.ts` (é o
    // fallback dele), mas `tenantId` fica `null` — nenhuma consulta escopada
    // por tenant vai apontar para a empresa errada.
    return contextoNeutro(host)
  }

  // --- 4. NEUTRO -----------------------------------------------------------
  return contextoNeutro(host)
}

/**
 * A fonte real: `tenant_domains` e `tenants` pelo service client.
 *
 * Service client porque a resolução acontece ANTES de haver sessão (a tela de
 * login já precisa da marca certa) e a RLS de `tenant_domains` só libera
 * leitura para `service_role` e `is_super_admin()` — ver
 * `docs/faxina-2026-09/06-contrato-de-dados.md` §2.1.
 *
 * Falha de banco devolve `null`, nunca lança: um Supabase fora do ar tem que
 * derrubar a MARCA para o neutro, não a aplicação inteira.
 */
export function fonteDoBanco(): FonteDeTenants {
  return {
    async porHost(host: string) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/service")
        const db = createServiceClient()
        const { data, error } = await db
          .from("tenant_domains")
          .select("tenant_id, tenants(id, slug)")
          .eq("host", host)
          .maybeSingle()
        if (error || !data) return null
        // O embed do PostgREST volta objeto OU array de um elemento conforme a
        // forma do relacionamento inferida; tratar os dois é mais barato do que
        // depender da inferência.
        const bruto = data.tenants as
          | { id: string; slug: string }
          | { id: string; slug: string }[]
          | null
        const t = Array.isArray(bruto) ? (bruto[0] ?? null) : bruto
        return t ? { id: t.id, slug: t.slug } : null
      } catch (e) {
        console.warn("[tenant] falha ao resolver dominio proprio:", e)
        return null
      }
    },
    async porSlug(slug: string) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/service")
        const db = createServiceClient()
        const { data, error } = await db
          .from("tenants")
          .select("id, slug")
          .eq("slug", slug)
          .maybeSingle()
        if (error || !data) return null
        return { id: data.id, slug: data.slug }
      } catch (e) {
        console.warn("[tenant] falha ao resolver slug:", e)
        return null
      }
    },
  }
}

/** A resolução de uma requisição real, com env e banco de verdade. */
export async function resolverTenantDaRequisicao(
  cabecalhos: Headers,
  slugDaQuery?: string | null,
): Promise<TenantContexto> {
  return resolverTenantPorHost(hostDaRequisicao(cabecalhos), {
    fonte: fonteDoBanco(),
    base: dominioBase(),
    slugLegado: slugDoAmbiente(),
    slugDaQuery,
    ehDesenvolvimento: process.env.NODE_ENV !== "production",
  })
}

/** O host canônico de uma empresa (D1): derivado por STRING, sem banco. */
export function hostCanonico(slug: string, base = dominioBase()): string | null {
  if (!base || !SLUG_RE.test(slug) || ehSlugReservado(slug)) return null
  return `${slug}.${base}`
}
