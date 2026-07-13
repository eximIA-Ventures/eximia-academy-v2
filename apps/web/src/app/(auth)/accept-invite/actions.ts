"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Provision the invited user's profile AFTER they set their password.
 *
 * Security (AUTH-04): the previous client-side upsert wrote `role` and
 * `tenant_id` straight from `user_metadata`, which a user can tamper with.
 * Here we run server-side with the service client and NEVER trust the client:
 *
 *  - The profile row is normally already created at invite time
 *    (api/admin/users invite flow) with the admin-chosen role/tenant.
 *    If it exists, we preserve role/tenant_id as-is.
 *  - If it does not exist yet, we derive tenant from the invite metadata
 *    (set by the admin via inviteUserByEmail, read server-side) and FORCE
 *    role = "student". Privileged roles must be granted by an admin, never
 *    self-provisioned on accept-invite.
 */
export async function provisionInvitedUser(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const service = createServiceClient()

  // If a profile already exists (created at invite time), keep its role/tenant.
  const { data: existing } = await service
    .from("users")
    .select("id, tenant_id, role")
    .eq("id", user.id)
    .single()

  // Invite metadata is set by the admin via inviteUserByEmail (server-side),
  // not editable through the standard client session.
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const fullName = (typeof metadata.full_name === "string" && metadata.full_name) || "Novo Usuário"

  if (existing) {
    // Only backfill display fields; role/tenant_id are immutable here.
    const { error } = await service
      .from("users")
      .update({
        email: user.email,
        full_name: fullName,
      })
      .eq("id", user.id)

    if (error) return { error: "Erro ao concluir cadastro" }
    return { success: true }
  }

  // Fallback: profile missing — derive tenant from invite metadata, force student.
  const tenantId = typeof metadata.tenant_id === "string" ? metadata.tenant_id : null
  if (!tenantId) return { error: "Convite inválido: tenant ausente" }

  const { error } = await service.from("users").insert({
    id: user.id,
    tenant_id: tenantId,
    email: user.email,
    full_name: fullName,
    role: "student",
    status: "active",
    onboarding_completed: false,
  })

  if (error) return { error: "Erro ao concluir cadastro" }
  return { success: true }
}
