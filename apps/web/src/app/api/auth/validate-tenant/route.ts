import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/**
 * POST /api/auth/validate-tenant
 * After login, validates tenant access and resolves redirect.
 * Body: { tenantSlug: string | null }
 * Returns: { allowed, redirectSlug?, error?, userTenantSlug? }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ allowed: false, error: "Não autenticado" }, { status: 401 })
  }

  const body = await request.json()
  const tenantSlug: string | null = body.tenantSlug || null

  const service = createServiceClient()

  // Get user profile
  const { data: profile } = await service
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ allowed: false, error: "Perfil não encontrado" }, { status: 404 })
  }

  // Super admin — always allowed, redirect to super-admin panel
  if (profile.role === "super_admin") {
    return NextResponse.json({ allowed: true, redirectSlug: null, superAdmin: true })
  }

  // No slug provided (login at /login) — resolve user's tenant(s)
  if (!tenantSlug) {
    // Get user's memberships
    const { data: memberships } = await service
      .from("user_tenant_memberships")
      .select("tenant_id, role, tenants(slug, name)")
      .eq("user_id", user.id)

    const tenants = (memberships ?? [])
      .map((m: any) => ({
        id: m.tenant_id,
        slug: m.tenants?.slug,
        name: m.tenants?.name,
        role: m.role,
      }))
      .filter((t: any) => t.slug)

    if (tenants.length === 0) {
      // Fallback to user's primary tenant
      const { data: primaryTenant } = await service
        .from("tenants")
        .select("slug")
        .eq("id", profile.tenant_id)
        .single()

      if (primaryTenant?.slug) {
        return NextResponse.json({ allowed: true, redirectSlug: primaryTenant.slug })
      }
      return NextResponse.json({ allowed: false, error: "Nenhuma organização vinculada" })
    }

    if (tenants.length === 1) {
      // Single tenant — go directly
      return NextResponse.json({ allowed: true, redirectSlug: tenants[0].slug })
    }

    // Multiple tenants — redirect to org selector
    return NextResponse.json({ allowed: true, redirectSlug: null, selectOrg: true, tenants })
  }

  // Slug provided — validate access to specific tenant
  const { data: tenant } = await service
    .from("tenants")
    .select("id, slug")
    .eq("slug", tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ allowed: false, error: "Organização não encontrada" }, { status: 404 })
  }

  // Active tenant matches
  if (profile.tenant_id === tenant.id) {
    return NextResponse.json({ allowed: true, redirectSlug: tenantSlug })
  }

  // Check membership
  const { data: membership } = await service
    .from("user_tenant_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenant.id)
    .single()

  if (membership) {
    // Auto-switch active tenant
    await service
      .from("users")
      .update({ tenant_id: tenant.id })
      .eq("id", user.id)

    return NextResponse.json({ allowed: true, redirectSlug: tenantSlug, switched: true })
  }

  // No access
  return NextResponse.json({
    allowed: false,
    error: "Você não tem acesso a esta organização",
  })
}
