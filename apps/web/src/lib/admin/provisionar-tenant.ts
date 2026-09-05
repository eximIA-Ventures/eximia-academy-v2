import { inviteTenantUser } from "@/app/api/admin/users/invite-user"
import { logAdminAction } from "@/lib/audit"
import { createServiceClient } from "@/lib/supabase/service"
import type { CreateTenantData } from "@eximia/shared"
import { hostCanonico } from "./host-canonico"

// ===========================================================================
// CADASTRAR UMA EMPRESA É UMA TRANSAÇÃO + UM I/O EXTERNO, NESSA ORDEM (D10)
//
// A transação é a RPC `provisionar_tenant` (`06-contrato-de-dados.md` §4.2):
// tenant + domínio próprio + `seed_tenant_defaults` (áreas e os 6
// `notification_templates`) + auditoria, tudo ou nada. O motivo é histórico e
// literal: o processo equivalente já foi um script que travou no meio e exigiu
// um segundo script para retomar. Meia empresa criada é pior do que nenhuma.
//
// O convite do primeiro admin fica FORA da transação, DEPOIS do commit, porque
// `inviteUserByEmail` é HTTP para o GoTrue: dentro da transação ele seguraria
// lock de banco esperando rede. Se o convite falhar, a empresa EXISTE e a tela
// oferece "reenviar convite" — nunca apagamos o tenant para "desfazer", porque
// o seed já rodou e o super_admin já viu a empresa na lista.
//
// Este módulo não decide QUEM pode cadastrar: o guard de `super_admin` é da
// rota. Ele também não valida o corpo: o `createTenantSchema` valida.
// ===========================================================================

/** O que a RPC devolve (`§4.2`, passo 7). */
interface RetornoDaRpc {
  tenant_id?: string
  slug?: string
  auditado?: boolean
}

export interface ResultadoDoConvite {
  status: "sent" | "failed"
  /** Em que ponto falhou: `invite` (GoTrue) ou `profile` (linha em `users`). */
  stage?: "invite" | "profile"
  error?: string
  userId?: string | null
}

export interface TenantProvisionado {
  id: string
  name: string
  slug: string
  plan: string
  brand: Record<string, unknown>
  modules: string[]
  /** `{slug}.{base}`, derivado por string (D1). `null` se a env base não existe. */
  host: string | null
  /** Domínio próprio, quando o super_admin informou um. */
  customHost: string | null
}

export type ResultadoDeProvisionamento =
  | {
      ok: true
      tenant: TenantProvisionado
      adminInvite: ResultadoDoConvite
      /** `false` = a RPC não conseguiu auditar e este módulo auditou por fora. */
      auditadoNaRpc: boolean
    }
  | { ok: false; status: number; error: string }

/**
 * SQLSTATE → HTTP. A tabela é do contrato (`§4.2`), não uma escolha local:
 * `22023` é dado inválido (nome/slug/plano/brand/host, ou slug reservado) e
 * `23505` é colisão de slug ou de domínio próprio.
 */
const HTTP_POR_SQLSTATE: Record<string, number> = {
  "22023": 400,
  "23505": 409,
}

function mensagemDeErro(codigo: string | undefined, mensagemDoBanco: string): string {
  if (codigo === "23505") return "Slug ou domínio próprio já está em uso por outra empresa."
  return mensagemDoBanco
}

/** Só o que o app grava fora de `tenants.brand/modules` (mapa da §2.2 do contrato). */
function montarSettings(entrada: CreateTenantData) {
  const settings: Record<string, unknown> = {}
  const whitelabel: Record<string, unknown> = {}
  if (entrada.settings?.maxInteractionsPerSession !== undefined) {
    settings.max_interactions_per_session = entrada.settings.maxInteractionsPerSession
  }
  if (entrada.settings?.footerText !== undefined)
    whitelabel.footer_text = entrada.settings.footerText
  if (entrada.settings?.supportEmail !== undefined) {
    whitelabel.support_email = entrada.settings.supportEmail
  }
  return { settings, whitelabel }
}

export async function provisionarTenant(
  entrada: CreateTenantData,
  atorId: string,
): Promise<ResultadoDeProvisionamento> {
  const supabase = createServiceClient()

  // O id pode vir do cliente porque o logo já foi para `tenant-assets/{id}/`
  // antes do POST (ver o campo `id` em `createTenantSchema`). Quando não vem,
  // nasce aqui — o banco nunca escolhe, senão o path do upload apontaria para
  // uma pasta órfã.
  const tenantId = entrada.id ?? crypto.randomUUID()

  // `brand.slug` e `brand.name` são forçados: a RPC faz o mesmo do lado do
  // banco, e mandar divergente daqui só produziria uma diferença silenciosa
  // entre o que a tela mostrou e o que ficou gravado.
  const brand: Record<string, unknown> = {
    ...entrada.brand,
    name: entrada.brand.name ?? entrada.name,
    slug: entrada.slug,
  }

  const { data, error } = await supabase.rpc("provisionar_tenant", {
    p_name: entrada.name,
    p_slug: entrada.slug,
    p_plan: entrada.plan,
    p_brand: brand,
    p_modules: entrada.modules,
    p_custom_host: entrada.customHost ?? null,
    p_id: tenantId,
    p_actor_id: atorId,
  })

  if (error) {
    const codigo = error.code ?? undefined
    return {
      ok: false,
      status: HTTP_POR_SQLSTATE[codigo ?? ""] ?? 500,
      error: mensagemDeErro(codigo, error.message),
    }
  }

  const retorno = (data ?? {}) as RetornoDaRpc
  const idGravado = retorno.tenant_id ?? tenantId
  const auditadoNaRpc = retorno.auditado === true

  // -------------------------------------------------------------------------
  // `settings` fica FORA da RPC de propósito: `tenants.settings` e
  // `tenants.whitelabel_config` são jsonb livres já escritos por outras telas
  // (`whitelabel-actions.ts`), e a RPC sobrescrevê-los inteiros apagaria o que
  // aquelas telas gravam. Aqui a mesclagem é rasa e explícita.
  // -------------------------------------------------------------------------
  const { settings, whitelabel } = montarSettings(entrada)
  const { data: linha } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, brand, modules, settings, whitelabel_config")
    .eq("id", idGravado)
    .single()

  let tenantFinal = linha as Record<string, unknown> | null

  if (Object.keys(settings).length > 0 || Object.keys(whitelabel).length > 0) {
    const atuais = (tenantFinal?.settings ?? {}) as Record<string, unknown>
    const atuaisWhitelabel = (tenantFinal?.whitelabel_config ?? {}) as Record<string, unknown>
    const { data: atualizada } = await supabase
      .from("tenants")
      .update({
        settings: { ...atuais, ...settings },
        whitelabel_config: { ...atuaisWhitelabel, ...whitelabel },
      })
      .eq("id", idGravado)
      .select("id, name, slug, plan, brand, modules, settings, whitelabel_config")
      .single()
    if (atualizada) tenantFinal = atualizada as Record<string, unknown>
  }

  // -------------------------------------------------------------------------
  // Auditoria por fora quando a RPC não conseguiu auditar.
  // `platform_audit_log.actor_id` é NOT NULL com FK para `auth.users`, e o JWT
  // de `service_role` não tem `sub` — se o ator não existir, a RPC devolve
  // `auditado: false` e cria a empresa mesmo assim. Deixar assim seria criar
  // empresa sem rastro de quem criou.
  // -------------------------------------------------------------------------
  if (!auditadoNaRpc) {
    await logAdminAction({
      actorId: atorId,
      tenantId: idGravado,
      action: "tenant.provisioned",
      targetType: "tenant",
      targetId: idGravado,
      details: {
        slug: entrada.slug,
        plan: entrada.plan,
        modules: entrada.modules,
        custom_host: entrada.customHost ?? null,
        auditado_pela_rpc: false,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Convite do primeiro admin — depois do commit, e o resultado VIAJA na
  // resposta. `role: "admin"` porque quem recebe a empresa precisa poder
  // cadastrar gente; `manager` não pode.
  // -------------------------------------------------------------------------
  const convite = await inviteTenantUser(supabase, idGravado, {
    email: entrada.admin.email,
    full_name: entrada.admin.fullName,
    role: "admin",
  })

  const adminInvite: ResultadoDoConvite = convite.ok
    ? { status: "sent", userId: convite.userId }
    : { status: "failed", stage: convite.stage, error: convite.message }

  return {
    ok: true,
    auditadoNaRpc,
    adminInvite,
    tenant: {
      id: idGravado,
      name: (tenantFinal?.name as string) ?? entrada.name,
      slug: (tenantFinal?.slug as string) ?? entrada.slug,
      plan: (tenantFinal?.plan as string) ?? entrada.plan,
      brand: (tenantFinal?.brand as Record<string, unknown>) ?? brand,
      modules: (tenantFinal?.modules as string[]) ?? entrada.modules,
      host: hostCanonico(entrada.slug),
      customHost: entrada.customHost ?? null,
    },
  }
}
