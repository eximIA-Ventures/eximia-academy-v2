import { headers } from "next/headers"
import type { NextRequest } from "next/server"
import { hostCanonico } from "./tenant/resolver"

// ===========================================================================
// A URL QUE VAI DENTRO DO E-MAIL (D11)
//
// O DEFEITO QUE ISTO CORRIGE. Os três lugares que mandam e-mail —
// `api/admin/users/invite-user.ts`, `api/admin/users/[userId]/resend-invite`,
// `api/notifications/nudge` — montavam o link com `NEXT_PUBLIC_APP_URL`, UMA
// variável por serviço. Num serviço multiempresa isso manda a pessoa da
// empresa B para o endereço da A: ela clica no convite e cai num host que não
// é o dela, onde a D3 a redireciona (na melhor hipótese) ou onde o token de
// convite simplesmente não é aceito pela allowlist de Redirect URLs do
// Supabase (na pior, e em silêncio).
//
// ORDEM, e o porquê de cada degrau:
//   1. `tenant_domains` com `is_primary` — se a empresa tem domínio próprio,
//      é o endereço que ela reconhece como dela.
//   2. `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` — o host canônico, derivado por
//      STRING (D1). Não custa banco e sempre existe para empresa cadastrada.
//   3. `x-forwarded-host` da requisição em curso — quando não há tenant (fluxo
//      neutro), o endereço por onde a pessoa chegou é o melhor palpite.
//   4. `NEXT_PUBLIC_APP_URL` — o comportamento antigo, como último recurso.
//
// [HUGO] O passo 2 só funciona ponta a ponta com `https://*.{base}/**` na
// allowlist de Authentication → URL Configuration → Redirect URLs do Supabase,
// mais uma linha por domínio próprio (D11).
// ===========================================================================

/**
 * Base URL a partir dos cabeçalhos de uma requisição.
 *
 * Lê `x-forwarded-proto`/`x-forwarded-host` (postos pelo Traefik em produção)
 * com queda para `host` e, por fim, `NEXT_PUBLIC_APP_URL`.
 */
export function getBaseUrl(request: Request | NextRequest): string {
  return baseDosCabecalhos(request.headers) ?? urlDoAmbiente()
}

function urlDoAmbiente(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

function baseDosCabecalhos(cabecalhos: Headers): string | null {
  const proto = cabecalhos.get("x-forwarded-proto") ?? "https"
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host")
  return host ? `${proto}://${host.split(",")[0]?.trim()}` : null
}

/** `localhost` e `127.0.0.1` não têm TLS em desenvolvimento. */
function esquemaPara(host: string): string {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"
}

/**
 * A base URL canônica de uma empresa — a que entra em `redirectTo` e nos links
 * de e-mail.
 *
 * `tenantId` nulo (fluxo neutro) pula direto para os degraus 3 e 4. Nunca
 * lança: um e-mail com o link antigo é ruim, um convite que não sai é pior.
 */
export async function getBaseUrlForTenant(tenantId: string | null): Promise<string> {
  if (tenantId) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/service")
      const db = createServiceClient()

      // 1. Domínio próprio primário.
      const { data: dominio } = await db
        .from("tenant_domains")
        .select("host")
        .eq("tenant_id", tenantId)
        .eq("is_primary", true)
        .maybeSingle()
      if (dominio?.host) return `${esquemaPara(dominio.host)}://${dominio.host}`

      // 2. Host canônico, derivado do slug por string (D1).
      const { data: tenant } = await db
        .from("tenants")
        .select("slug")
        .eq("id", tenantId)
        .maybeSingle()
      const canonico = tenant?.slug ? hostCanonico(tenant.slug) : null
      if (canonico) return `${esquemaPara(canonico)}://${canonico}`
    } catch (e) {
      console.warn("[get-base-url] falha ao resolver o host do tenant:", e)
    }
  }

  // 3. O host desta requisição, quando houver uma.
  try {
    const daRequisicao = baseDosCabecalhos(await headers())
    if (daRequisicao) return daRequisicao
  } catch {
    // Fora de escopo de requisição (cron, job). Segue para o degrau 4.
  }

  // 4. O comportamento antigo.
  return urlDoAmbiente()
}
