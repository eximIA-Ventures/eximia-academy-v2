"use server"

import { requireRole } from "@/lib/api-role-guard"
import { logAdminAction } from "@/lib/audit"
import { generateKey } from "@/lib/integration/helpers"
import { PAPEIS_CHAVES_INTEGRACAO } from "@/lib/papeis-de-conteudo"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  )
}

/**
 * Devolve exatamente um dos dois lados: `auth` quando a pessoa passou, `recusa`
 * quando não passou — e a recusa já diz QUAL das três situações ocorreu.
 *
 * Antes desta correção o helper devolvia `null` para as três (sem sessão, papel
 * insuficiente, leitura de perfil que FALHOU) e os dois handlers respondiam 403
 * para todas. Um admin legítimo num timeout de statement lia "Permissão negada".
 *
 * O 403 de "sem sessão" (que deveria ser 401) foi mantido de propósito: é outro
 * defeito, e mudar contrato de resposta a pretexto de arrumar tratamento de erro
 * esconderia a mudança dentro do fix. Está registrado, com CP que trava o
 * comportamento atual.
 */
async function requireAdminOrSuper(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { auth: null, recusa: NextResponse.json({ error: "Permissão negada" }, { status: 403 }) }
  }

  const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_CHAVES_INTEGRACAO)
  if (recusa) return { auth: null, recusa }

  return {
    auth: {
      userId: user.id,
      role: profile.role,
      // `requireRole` normaliza tenant ausente para `""`, e aqui `tenantId` cai
      // num `??` e depois num teste de veracidade: `""` (falsy) atravessaria a
      // trava "apenas super admin cria chave de plataforma" por onde `null` não
      // passa. Restaurar o `null` preserva a trava exatamente como estava.
      tenantId: profile.tenant_id === "" ? null : profile.tenant_id,
    },
    recusa: null,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { auth, recusa } = await requireAdminOrSuper(supabase)
  if (recusa) return recusa

  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenant_id") ?? auth.tenantId

  // Only super_admin can query other tenants
  if (tenantId !== auth.tenantId && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from("integration_keys")
    .select("id, app_name, key_prefix, scopes, status, last_used, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { auth, recusa } = await requireAdminOrSuper(supabase)
  if (recusa) return recusa

  const body = await request.json()
  const { app_name, scopes = ["read"], tenant_id } = body

  if (!app_name) return NextResponse.json({ error: "app_name obrigatório" }, { status: 400 })

  // tenant_id can be: a specific tenant, null (platform-level, super_admin only), or default to user's tenant
  const targetTenant = tenant_id === "platform" ? null : (tenant_id ?? auth.tenantId)
  if (targetTenant === null && auth.role !== "super_admin") {
    return NextResponse.json(
      { error: "Apenas super admin pode criar chaves de plataforma" },
      { status: 403 },
    )
  }
  if (targetTenant && targetTenant !== auth.tenantId && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const { raw, prefix, hash } = generateKey(app_name.replace(/\s+/g, "-").toLowerCase())

  const service = createServiceClient()
  const { data, error } = await service
    .from("integration_keys")
    .insert({
      tenant_id: targetTenant,
      app_name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      created_by: auth.userId,
    })
    .select("id, app_name, key_prefix, scopes, status, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    actorId: auth.userId,
    tenantId: targetTenant,
    action: "integration.key_created",
    targetType: "integration",
    targetId: data.id,
    // Display prefix only — the raw key/hash NEVER goes to details
    details: { app_name, key_prefix: prefix, ip: requestIp(request) },
  })

  // Return raw key ONLY on creation (never stored, never retrievable again)
  return NextResponse.json({ data: { ...data, api_key: raw } }, { status: 201 })
}
