import { type InviteOutcome, inviteTenantUser } from "@/app/api/admin/users/invite-user"
import { recusaSePerfilIlegivel } from "@/lib/api-auth/perfil-de-sessao"
import { logAdminAction } from "@/lib/audit"
import { getAuthProfile } from "@/lib/auth"
import { getBaseUrlForTenant } from "@/lib/get-base-url"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

// ===========================================================================
// POST /api/admin/tenants/[tenantId]/convidar-admin — o "reenviar convite"
//
// Existe porque o convite do primeiro admin acontece FORA da transação, depois
// do commit (D10): se o GoTrue estiver fora do ar, a empresa fica criada e sem
// ninguém dentro. A resposta do cadastro diz isso à tela, e a tela precisa de um
// lugar para tentar de novo.
//
// `users/[userId]/resend-invite` NÃO serve para este caso: ele parte de um
// usuário que já existe, e aqui o convite falhou justamente ANTES de existir.
// E `POST /api/admin/users` cria no tenant ATIVO do super_admin (cookie
// `x-sa-active-tenant`), não no tenant recém-criado — usá-lo colocaria o admin
// da empresa nova dentro de outra empresa.
//
// POR QUE HÁ DOIS CAMINHOS, E NÃO SÓ `inviteUserByEmail`
// -----------------------------------------------------
// `inviteUserByEmail` recusa e-mail JÁ REGISTRADO. E os dois modos de falha
// mais prováveis do cadastro deixam justamente uma conta de Auth existente:
//   * `stage: "profile"` — o convite SAIU e só o INSERT em `public.users`
//     falhou (`invite-user.ts`), então `auth.users` já tem a linha;
//   * `stage: "invite"` com "already been registered" — a pessoa já tem conta
//     (outra empresa, ou uma tentativa anterior).
// Nos dois, chamar `inviteUserByEmail` de novo devolve erro para sempre, e o
// botão "reenviar convite" que a tela oferece nunca conserta nada — a empresa
// fica criada e sem admin. Por isso a queda para `generateLink({type:"invite"})`,
// que é o MESMO mecanismo de `users/[userId]/resend-invite` e funciona para
// usuário existente ainda não confirmado, seguida do `upsert` da linha de
// perfil, que é a metade que faltou no `stage: "profile"`.
// ===========================================================================

const corpoSchema = z.object({
  email: z.string().email("Email inválido"),
  fullName: z.string().min(1, "Nome obrigatório").max(200),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { user, profile, error: erroDePerfil } = await getAuthProfile()
  const indisponivel = recusaSePerfilIlegivel(
    erroDePerfil,
    "/api/admin/tenants/[tenantId]/convidar-admin",
  )
  if (indisponivel) return indisponivel
  if (!user || !profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 })
  }

  const parsed = corpoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase.from("tenants").select("id").eq("id", tenantId).single()
  if (!tenant) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 })
  }

  let convite = await inviteTenantUser(supabase, tenantId, {
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: "admin",
  })

  // O convite não saiu porque a conta de Auth já existe (ver cabeçalho). Tenta
  // pelo caminho que aceita usuário existente. Se ele também falhar, a mensagem
  // devolvida é a ORIGINAL: ela descreve o motivo de verdade (GoTrue fora do ar,
  // e-mail já confirmado), e não o sintoma da segunda tentativa.
  if (!convite.ok && convite.stage === "invite") {
    const recuperado = await reconvidarAdminExistente(supabase, tenantId, parsed.data)
    if (recuperado.ok) convite = recuperado
  }

  if (!convite.ok) {
    return NextResponse.json({ error: convite.message, stage: convite.stage }, { status: 502 })
  }

  await logAdminAction({
    actorId: user.id,
    tenantId,
    action: "tenant.admin_invited",
    targetType: "tenant",
    targetId: tenantId,
    details: { email: parsed.data.email },
  })

  return NextResponse.json({ data: { status: "sent", userId: convite.userId } })
}

/**
 * O reenvio para quem JÁ TEM conta de Auth.
 *
 * `generateLink({ type: "invite" })` emite um link novo para um usuário
 * existente ainda não confirmado — é o mesmo mecanismo de
 * `api/admin/users/[userId]/resend-invite`. O `upsert` em `public.users` fecha o
 * outro buraco: no `stage: "profile"` o Auth tem a conta e o perfil não existe,
 * e sem a linha de perfil a pessoa entra sem tenant e sem papel.
 *
 * O link NUNCA volta para o chamador, pela mesma razão da rota irmã: quem recebe
 * o convite é o dono do e-mail, não quem clicou no botão.
 */
async function reconvidarAdminExistente(
  serviceClient: ReturnType<typeof createServiceClient>,
  tenantId: string,
  input: { email: string; fullName: string },
): Promise<InviteOutcome> {
  const baseUrl = await getBaseUrlForTenant(tenantId)

  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      // Metadata IDÊNTICO ao de `inviteTenantUser`: é o fallback que
      // `accept-invite/actions.ts` lê quando a linha de `users` ainda não existe.
      data: {
        tenant_id: tenantId,
        role: "admin",
        full_name: input.fullName,
        report_name: null,
      },
      redirectTo: `${baseUrl}/accept-invite`,
    },
  })

  if (error) return { ok: false, stage: "invite", message: error.message }

  const authUserId = data?.user?.id ?? null
  if (!authUserId) return { ok: true, userId: null }

  const { error: erroDePerfil } = await serviceClient.from("users").upsert(
    {
      id: authUserId,
      tenant_id: tenantId,
      email: input.email,
      full_name: input.fullName,
      role: "admin",
      status: "active",
      onboarding_completed: false,
    },
    { onConflict: "id" },
  )

  if (erroDePerfil) return { ok: false, stage: "profile", message: erroDePerfil.message }

  return { ok: true, userId: authUserId }
}
