import { logAdminAction } from "@/lib/audit"
import { resolveInviteTarget } from "@/lib/invites/target"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/**
 * Reenviar convite (CFG-2.2, AC4).
 *
 * Reemite o e-mail de convite para quem ainda não aceitou. Usa
 * `generateLink({ type: "invite" })`, o mesmo mecanismo já em produção em
 * `reset-password/route.ts` (`type: "recovery"`), e pela mesma razão o link
 * **nunca** volta para o chamador: quem recebe o convite é o dono do e-mail, não
 * quem clicou no botão.
 *
 * Não cria nem duplica linha em `public.users` — ela existe desde o convite
 * original (`api/admin/users/route.ts`). Este endpoint não escreve nada no
 * banco, exceto a linha de auditoria.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  // Guard completo (admin-tier + tenant + alvo + estado derivado). 409 se o
  // alvo já é "Ativo" ou "Desativado".
  const resolved = await resolveInviteTarget(userId)
  if (!resolved.ok) return resolved.response

  const { actorId, tenantId, target, displayStatus } = resolved

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.auth.admin.generateLink({
    type: "invite",
    email: target.email,
    options: {
      // Metadata IDÊNTICO ao do convite original (`api/admin/users/route.ts`).
      // `generateLink` grava o que receber: mandar menos apagaria `role` e
      // `tenant_id` do metadata, que é o fallback lido no aceite
      // (`accept-invite/actions.ts`) quando a linha de `users` não existe.
      data: {
        tenant_id: tenantId,
        role: target.role,
        full_name: target.full_name,
        report_name: target.report_name,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logAdminAction({
    actorId,
    tenantId,
    action: "user.invite_resent",
    targetType: "user",
    targetId: userId,
    details: { email: target.email, previous_state: displayStatus },
  })

  return NextResponse.json({ ok: true })
}
