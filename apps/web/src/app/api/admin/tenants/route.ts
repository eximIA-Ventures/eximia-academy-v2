import { provisionarTenant } from "@/lib/admin/provisionar-tenant"
import { recusaSePerfilIlegivel } from "@/lib/api-auth/perfil-de-sessao"
import { getAuthProfile } from "@/lib/auth"
import { createTenantSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

// ===========================================================================
// POST /api/admin/tenants — cadastrar uma empresa (D10)
//
// A rota faz TRÊS coisas e nada além: recusa quem não é super_admin, valida o
// corpo e delega. O "como" (RPC transacional + settings + auditoria + convite)
// mora em `lib/admin/provisionar-tenant.ts`, porque é a mesma sequência que
// qualquer outro caminho de cadastro precisaria repetir — e uma segunda cópia
// dela seria uma segunda chance de as duas divergirem.
//
// O guard continua no APP mesmo com a RPC sendo `SECURITY DEFINER`: a RPC só é
// executável por `service_role` (`REVOKE ... FROM authenticated`), e o service
// client não carrega identidade nenhuma. Host não autoriza, JWT de serviço não
// autoriza — quem autoriza é este `if`.
// ===========================================================================

export async function POST(request: Request) {
  const { user, profile, error: erroDePerfil } = await getAuthProfile()
  const indisponivel = recusaSePerfilIlegivel(erroDePerfil, "/api/admin/tenants")
  if (indisponivel) return indisponivel
  if (!user || !profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 })
  }

  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  // `user.id` e não `profile.id`: `getAuthProfile` seleciona colunas de `users`
  // sem o `id`, e `platform_audit_log.actor_id` tem FK para `auth.users(id)` —
  // é o id do Auth que a RPC precisa em `p_actor_id`.
  const resultado = await provisionarTenant(parsed.data, user.id)

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  // 201 mesmo quando o convite falha, de propósito: a EMPRESA foi criada e o
  // seed rodou. Devolver 500 aqui faria a tela dizer "não criou" sobre algo que
  // existe — o super_admin cadastraria de novo e colidiria no slug. O estado do
  // convite viaja no corpo para a tela oferecer "reenviar convite".
  return NextResponse.json(
    { tenant: resultado.tenant, adminInvite: resultado.adminInvite },
    { status: 201 },
  )
}
