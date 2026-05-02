"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

/**
 * Switch the authenticated user's active tenant.
 * Validates membership first, then updates users.tenant_id via service role.
 */
export async function switchTenant(tenantId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Não autenticado" }
  }

  // Validate membership
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .single()

  if (!membership) {
    return { error: "Sem acesso a este tenant" }
  }

  // Update users.tenant_id via service role (bypasses RLS)
  const service = createServiceClient()
  const { error } = await service
    .from("users")
    .update({ tenant_id: tenantId })
    .eq("id", user.id)

  if (error) {
    return { error: "Falha ao trocar tenant" }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

/**
 * Fetch all tenants the current user has membership in.
 */
export async function getUserTenants() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: memberships } = await supabase
    .from("user_tenant_memberships")
    .select("tenant_id, role, tenants(id, name, slug)")
    .eq("user_id", user.id)

  if (!memberships) return []

  return memberships.map((m) => {
    const t = m.tenants as unknown as { id: string; name: string; slug: string }
    return { id: t.id, name: t.name, slug: t.slug, role: m.role }
  })
}
