"use server"

import { logAdminAction } from "@/lib/audit"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { whitelabelConfigSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

// =============================================================================
// Correção de auditoria (rodada 3) — mesma dupla correção de `actions.ts`, que é
// a action irmã desta tela: (a) gate migrado da coluna singular `users.role`
// para a UNIÃO DE CHAPÉUS (`hasAnyRole`), conjunto permitido INALTERADO; e
// (b) tenant resolvido por `resolveTenantId` em vez de `role === "super_admin"
// ? null : ...`, que travava toda gravação do super_admin. Ver o cabeçalho de
// `actions.ts` para o raciocínio completo (inclusive por que a escrita segue no
// client autenticado, com RLS, e por que o UPDATE devolve as linhas afetadas).
// =============================================================================

export async function saveWhitelabelConfig(payload: Record<string, unknown>) {
  const { user, profile, roles, supabase } = await getAuthProfile()

  if (!user) return { error: "Não autenticado" }

  // Gate por CHAPÉU real (regra dura 3), conjunto permitido inalterado.
  if (!profile || !hasAnyRole({ roles }, ["admin", "super_admin"]))
    return { error: "Acesso negado" }

  const tenantId = await resolveTenantId(profile.tenant_id)

  if (!tenantId) return { error: "Nenhum tenant ativo selecionado" }

  // Check whitelabel gate
  const { data: tenant } = await supabase
    .from("tenants")
    .select("whitelabel_enabled")
    .eq("id", tenantId)
    .single()

  if (!tenant?.whitelabel_enabled) {
    return { error: "Whitelabel nao esta habilitado para este tenant" }
  }

  // Validate payload — empty object means reset to default
  const isReset = Object.keys(payload).length === 0
  let parsed: { data: Record<string, unknown> } = { data: {} }

  if (!isReset) {
    const result = whitelabelConfigSchema.safeParse(payload)
    if (!result.success) return { error: result.error.errors[0].message }
    parsed = result
  }

  // `.select("id")`: um UPDATE recusado pelo RLS casa 0 linhas e devolve
  // `error: null` — sem isto a tela diria "salvo" sem ter salvado nada.
  const { data: updated, error } = await supabase
    .from("tenants")
    .update({
      whitelabel_config: isReset ? {} : parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .select("id")

  if (error) return { error: error.message }
  if (!updated || updated.length === 0)
    return {
      error: "Não foi possível salvar: esta conta não tem permissão de escrita nesta empresa.",
    }

  await logAdminAction({
    actorId: user.id,
    tenantId,
    action: "settings.whitelabel_updated",
    targetType: "settings",
    targetId: tenantId,
    details: isReset ? { reset: true } : { campos_alterados: Object.keys(parsed.data) },
  })

  revalidatePath("/admin/settings")
  revalidatePath("/", "layout")

  return { success: true }
}
