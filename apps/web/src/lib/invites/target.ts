import { fetchAuthAccounts } from "@/app/(platform)/admin/users/auth-accounts"
import { requireAdmin } from "@/lib/api-auth/require-admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { type UserDisplayStatus, deriveUserDisplayStatus, isPendingInvite } from "./status"

/**
 * O guard compartilhado por `resend-invite` e `revoke-invite` (CFG-2.2, AC8).
 *
 * As duas rotas fazem exatamente a mesma checagem antes de tocar no Auth: quem
 * chama é admin-tier, qual é o tenant dele, o alvo existe DENTRO desse tenant, e
 * o estado derivado do alvo (AC2) autoriza a operação. Escrever isso duas vezes
 * seria escrever duas chances de as duas divergirem — e a que divergisse seria a
 * que apaga um usuário.
 *
 * O eixo de papel é o de CHAPÉUS (`requireAdmin`, `user_roles`), o mesmo já
 * usado por `reset-password/route.ts`, a rota irmã mais recente.
 */

interface TargetRow {
  id: string
  email: string
  status: string
  tenant_id: string | null
  /**
   * `role`/`full_name`/`report_name` vêm junto porque o reenvio precisa
   * RECONSTITUIR o `user_metadata` do convite original: `generateLink` com
   * `type: "invite"` grava o metadata que receber, e mandar menos do que o
   * convite original tinha significaria apagar `role`/`tenant_id` de lá — o
   * mesmo metadata que `accept-invite/actions.ts` lê como fallback quando a
   * linha de `users` não existe.
   */
  role: string
  full_name: string | null
  report_name: string | null
}

export type InviteTargetResult =
  | { ok: false; response: NextResponse }
  | {
      ok: true
      actorId: string
      tenantId: string
      target: TargetRow
      displayStatus: UserDisplayStatus
    }

/**
 * @param requirePendingInvite quando `true`, um alvo que já é "Ativo" ou
 * "Desativado" recebe 409: reenviar/revogar não são formas alternativas de
 * mexer em quem já entrou.
 */
export async function resolveInviteTarget(
  userId: string,
  { requirePendingInvite = true }: { requirePendingInvite?: boolean } = {},
): Promise<InviteTargetResult> {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  // Tenant do chamador: admin/super_admin sem tenant próprio usa o cookie do
  // seletor, mesmo padrão das demais rotas de `/api/admin/*`.
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nenhum tenant ativo. Selecione um tenant primeiro." },
        { status: 400 },
      ),
    }
  }

  const { data } = await supabase
    .from("users")
    .select("id, email, status, tenant_id, role, full_name, report_name")
    .eq("id", userId)
    .single()

  const target = (data ?? null) as TargetRow | null

  // Fronteira de tenant ANTES de qualquer chamada ao Auth: um id de outro tenant
  // nunca chega a virar uma leitura privilegiada.
  if (!target || target.tenant_id !== tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Usuário nao encontrado." }, { status: 404 }),
    }
  }

  const accounts = await fetchAuthAccounts([userId])
  const facts = accounts[userId]
  const displayStatus = deriveUserDisplayStatus({
    status: target.status,
    invited_at: facts?.invited_at ?? null,
    confirmed_at: facts?.confirmed_at ?? null,
  })

  if (requirePendingInvite && !isPendingInvite(displayStatus)) {
    // 409 e não 400: o pedido é válido, o ESTADO é que não permite. Inclui o
    // caso em que o Auth não respondeu — sem saber se há convite pendente, a
    // operação não acontece (a alternativa seria agir no escuro).
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            displayStatus === "inactive"
              ? "Este usuário está desativado — não há convite pendente para esta ação."
              : "Este usuário já aceitou o convite. Use Desativar em vez de revogar/reenviar.",
        },
        { status: 409 },
      ),
    }
  }

  return { ok: true, actorId: profile.id, tenantId, target, displayStatus }
}
