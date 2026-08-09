import type { createServiceClient } from "@/lib/supabase/service"

/**
 * A criação de UM usuário convidado, num lugar só (CFG-6.1).
 *
 * Antes desta story esta sequência morava inteira dentro do `POST` da rota de
 * usuários. O import em massa precisa exatamente da mesma sequência, e uma
 * segunda cópia dela seria uma segunda chance de as duas divergirem — a que
 * divergisse criaria contas com metadata diferente, e o aceite
 * (`accept-invite/actions.ts`) lê justamente esse metadata como fallback quando a
 * linha de `users` ainda não existe. Uma pessoa convidada pelo lote não pode
 * entrar num estado diferente de uma convidada pelo formulário.
 *
 * ## O que esta função NÃO faz
 *
 * Não decide quem pode convidar (isso é do guard da rota), não escreve
 * auditoria (a rota escreve, porque só ela sabe o ator) e não valida o formato
 * do e-mail (o `zod` da rota valida). Ela faz uma coisa: convida e materializa o
 * perfil.
 *
 * ## Estado de convite continua DERIVADO
 *
 * `status: "active"` no insert é o mesmo valor de antes e continua sendo o único
 * permitido pela `users_status_check` junto de `inactive`. "Convite pendente"
 * segue existindo só em memória, derivado de `invited_at`/`confirmed_at` do Auth
 * (`lib/invites/status.ts`) — nada aqui escreve estado de convite no banco.
 */

export interface InviteInput {
  email: string
  full_name: string
  report_name?: string | null
  role: string
}

export type InviteOutcome =
  | { ok: true; userId: string | null }
  | { ok: false; stage: "invite" | "profile"; message: string }

export async function inviteTenantUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  tenantId: string,
  input: InviteInput,
): Promise<InviteOutcome> {
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(input.email, {
    data: {
      tenant_id: tenantId,
      role: input.role,
      full_name: input.full_name,
      report_name: input.report_name ?? null,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
  })

  if (error) {
    return { ok: false, stage: "invite", message: error.message }
  }

  const authUserId = data.user?.id ?? null
  if (!authUserId) {
    // Sem id não há perfil a criar. Preserva o comportamento anterior do `POST`,
    // que simplesmente pulava o insert neste caso.
    return { ok: true, userId: null }
  }

  const { error: profileError } = await serviceClient.from("users").insert({
    id: authUserId,
    tenant_id: tenantId,
    email: input.email,
    full_name: input.full_name,
    report_name: input.report_name ?? null,
    role: input.role,
    status: "active",
    onboarding_completed: false,
  })

  if (profileError) {
    // O convite JÁ foi enviado — dizer só "falhou" esconderia uma conta de Auth
    // criada sem perfil, que é exatamente o estado que precisa ser visto.
    return { ok: false, stage: "profile", message: profileError.message }
  }

  return { ok: true, userId: authUserId }
}
