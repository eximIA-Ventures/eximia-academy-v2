import { logAdminAction } from "@/lib/audit"
import {
  inspectRevokeSafety,
  isRevokeSafe,
  revokeBlockedMessage,
} from "@/lib/invites/revoke-safety"
import { resolveInviteTarget } from "@/lib/invites/target"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/**
 * Revogar convite (CFG-2.2, AC5) — a ÚNICA operação irreversível desta story.
 *
 * Encerra o ciclo do convite sem nunca ter existido um usuário ativo: apaga a
 * conta do Auth e a linha ainda virgem de `public.users`. É o que o mockup
 * promete e o que a desativação não consegue fazer (desativar pressupõe alguém
 * que entrou).
 *
 * ## A ordem dos passos é a proteção
 *
 * 1. guard (admin-tier, tenant, alvo, estado derivado) — 409 se já aceitou;
 * 2. **verificação de vínculos** (`inspectRevokeSafety`) — aborta se houver
 *    QUALQUER dado dependente, ou se não der para verificar;
 * 3. só então `deleteUser`;
 * 4. remoção explícita da linha de `users`;
 * 5. auditoria.
 *
 * O passo 2 vem antes do 3 porque `public.users.id` é
 * `REFERENCES auth.users(id) ON DELETE CASCADE`: o `deleteUser` sozinho já
 * derruba a linha do produto e tudo que pendura nela, em silêncio. Verificar
 * depois seria verificar o que já foi apagado.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const resolved = await resolveInviteTarget(userId)
  if (!resolved.ok) return resolved.response

  const { actorId, tenantId, target, displayStatus } = resolved

  // Ninguém revoga o próprio convite: quem está chamando esta rota, por
  // definição, já entrou no produto.
  if (userId === actorId) {
    return NextResponse.json(
      { error: "Você nao pode revogar seu proprio acesso." },
      { status: 400 },
    )
  }

  // Trava do destrutivo. Fail-closed: vínculo encontrado OU não verificável
  // cancela a operação (`revoke-safety.ts`).
  const safety = await inspectRevokeSafety(userId)
  if (!isRevokeSafe(safety)) {
    return NextResponse.json(
      {
        error: revokeBlockedMessage(safety),
        blockers: safety.blockers,
        unverifiable: safety.unverifiable,
      },
      { status: 409 },
    )
  }

  const serviceClient = createServiceClient()

  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // A linha de `users` normalmente já caiu no CASCADE do passo anterior; este
  // delete é o que garante o resultado quando o CASCADE não existir no ambiente
  // (drift de schema). Uma linha ausente aqui é sucesso, não erro — por isso a
  // falha é registrada e não derruba a resposta: a conta do Auth já foi apagada,
  // e devolver 500 faria o admin achar que nada aconteceu.
  const { error: rowError } = await serviceClient.from("users").delete().eq("id", userId)

  await logAdminAction({
    actorId,
    tenantId,
    action: "user.invite_revoked",
    targetType: "user",
    targetId: userId,
    details: {
      email: target.email,
      previous_state: displayStatus,
      // Rastro honesto: se a linha do produto resistiu, isso fica escrito.
      profile_row_error: rowError?.message ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
