import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/tenant"
import { NextResponse } from "next/server"

// ===========================================================================
// D9 — O SLUG VEM DO HOST, NÃO DO CORPO NEM DO BUILD.
//
// A rota recebia `tenantSlug` do formulário de login, que por sua vez o lia de
// `getTenantConfig().brand.slug` — um literal de BUILD. Num artefato só para
// todas as empresas aquele valor não distingue mais nada, e um valor vindo do
// corpo é escolhido por quem chama: bastaria mandar o slug certo para a
// checagem sempre passar.
//
// Agora a fonte é `x-tenant-slug`, escrito pelo middleware a partir do HOST (e
// apagado da entrada antes, para o cliente não o forjar). O corpo continua
// aceito como QUEDA para o serviço legado, onde o host é neutro e não afirma
// empresa nenhuma.
//
// E isto continua NÃO sendo a trava de acesso: quem decide o que cada pessoa
// lê é a RLS, com o JWT dela. O que esta rota impede é a incoerência de entrar
// no endereço da empresa A com a conta da B.
// ===========================================================================

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ allowed: false, error: "Não autenticado" }, { status: 401 })
  }

  let slugDoCorpo: string | null = null
  try {
    const body = (await request.json()) as { tenantSlug?: string | null }
    slugDoCorpo = body?.tenantSlug ?? null
  } catch {
    slugDoCorpo = null
  }

  const contexto = await getTenantContext()
  const tenantSlug = contexto.isNeutro ? slugDoCorpo : contexto.slug

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, tenants(slug)")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ allowed: false, error: "Usuário não encontrado" }, { status: 404 })
  }

  // Super admin — no tenant restriction
  if (profile.role === "super_admin") {
    return NextResponse.json({ allowed: true, superAdmin: true })
  }

  // Regular user — only allowed when the requested tenant matches their own.
  // `tenants` may come back as an object or a single-element array depending on the join shape.
  const tenants = profile.tenants as { slug?: string } | { slug?: string }[] | null
  const profileSlug = Array.isArray(tenants) ? (tenants[0]?.slug ?? null) : (tenants?.slug ?? null)

  if (tenantSlug && tenantSlug !== profileSlug) {
    // Acesso multiempresa (D3): a coluna `users.tenant_id` não é a única forma
    // de alcançar uma empresa — `user_tenant_memberships` também vale, e é a
    // MESMA regra que o middleware aplica. Sem esta segunda checagem, quem tem
    // vínculo secundário seria deslogado no próprio host da empresa.
    const { data: vinculo } = await supabase
      .from("user_tenant_memberships")
      .select("tenant_id, tenants(slug)")
      .eq("user_id", user.id)
      .limit(50)

    const alcanca = (vinculo ?? []).some((linha) => {
      const t = linha.tenants as { slug?: string } | { slug?: string }[] | null
      const slug = Array.isArray(t) ? (t[0]?.slug ?? null) : (t?.slug ?? null)
      return slug === tenantSlug
    })

    if (!alcanca) {
      return NextResponse.json(
        { allowed: false, error: "Você não tem acesso a esta organização" },
        { status: 403 },
      )
    }
  }

  return NextResponse.json({
    allowed: true,
    superAdmin: false,
  })
}
