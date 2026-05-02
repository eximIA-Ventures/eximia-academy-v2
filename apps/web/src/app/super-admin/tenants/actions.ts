"use server"

import { clearActiveTenant, setActiveTenant } from "@/lib/super-admin-context"
import { createClient } from "@/lib/supabase/server"
import { logSuperAdminAction } from "@/lib/audit"
import { redirect } from "next/navigation"

export async function switchToTenantContext(tenantId: string) {
  const supabase = await createClient()

  // Verify super_admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  // Validate tenant exists and is active
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, status")
    .eq("id", tenantId)
    .single()

  if (!tenant || tenant.status !== "active") {
    redirect("/super-admin/tenants")
  }

  // Set cookie (backward compat)
  await setActiveTenant(tenantId)

  // Log audit
  await logSuperAdminAction(user.id, "tenant_switched", "tenant", tenantId, {
    tenant_name: tenant.name,
  })

  // Redirect to path-based tenant dashboard
  redirect(`/${tenant.slug}/dashboard`)
}

export async function exitTenantContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  await clearActiveTenant()
  redirect("/super-admin/tenants")
}
