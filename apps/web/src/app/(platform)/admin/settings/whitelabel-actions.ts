"use server"

import { createClient } from "@/lib/supabase/server"
import { whitelabelConfigSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

export async function saveWhitelabelConfig(payload: Record<string, unknown>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role))
    return { error: "Acesso negado" }

  // Resolve tenant_id: super_admin uses active tenant cookie
  const tenantId =
    profile.role === "super_admin"
      ? await getActiveTenantForSuperAdmin()
      : profile.tenant_id

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

  const { error } = await supabase
    .from("tenants")
    .update({
      whitelabel_config: isReset ? {} : parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)

  if (error) return { error: error.message }

  revalidatePath("/admin/settings")
  revalidatePath("/", "layout")

  return { success: true }
}
