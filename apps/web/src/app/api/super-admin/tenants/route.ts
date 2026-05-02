import { logSuperAdminAction } from "@/lib/audit"
import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createTenantSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)
  const plan = searchParams.get("plan")
  const status = searchParams.get("status")
  const rawSearch = searchParams.get("search")
  const search = rawSearch ? rawSearch.replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "").trim() : null

  // Use service client for cross-tenant access (super admin has no tenant_id)
  const serviceClient = createServiceClient()

  let query = serviceClient
    .from("tenants")
    .select("id, name, slug, plan, status, whitelabel_enabled, created_at")
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  if (plan) {
    query = query.eq("plan", plan)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  // Fetch user counts for each tenant
  const tenantIds = items.map((t) => t.id)
  let userCounts: Record<string, number> = {}

  if (tenantIds.length > 0) {
    // Use individual count queries instead of fetching all rows
    const countPromises = tenantIds.map(async (tid) => {
      const { count } = await serviceClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
      return { tid, count: count ?? 0 }
    })
    const countResults = await Promise.all(countPromises)
    for (const { tid, count } of countResults) {
      userCounts[tid] = count
    }
  }

  const tenants = items.map((t) => ({
    ...t,
    user_count: userCounts[t.id] || 0,
  }))

  return NextResponse.json({ data: tenants, nextCursor })
}

/* ---------------------------------- POST ---------------------------------- */

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Check slug uniqueness
  const { data: existingSlug } = await serviceClient
    .from("tenants")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle()

  if (existingSlug) {
    return NextResponse.json({ error: "Slug já esta em uso. Escolha outro." }, { status: 409 })
  }

  // Create tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from("tenants")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      plan: parsed.data.plan,
      branding: parsed.data.branding || {},
      settings: parsed.data.settings || {},
      status: "active",
      whitelabel_enabled: false,
      whitelabel_config: {},
    })
    .select("id, name, slug, plan, status, created_at")
    .single()

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 })
  }

  // Audit log
  await logSuperAdminAction(user.id, "create_tenant", "tenant", tenant.id, {
    name: parsed.data.name,
    slug: parsed.data.slug,
    plan: parsed.data.plan,
  })

  // Invite initial manager if provided
  if (parsed.data.initial_manager) {
    const manager = parsed.data.initial_manager
    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(manager.email, {
        data: {
          tenant_id: tenant.id,
          role: manager.role,
          full_name: manager.full_name,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
      })

    if (inviteError) {
      return NextResponse.json(
        {
          data: tenant,
          warning: `Empresa criada, mas falha ao convidar gestor: ${inviteError.message}`,
        },
        { status: 201 },
      )
    }

    // Create user profile
    const authUserId = inviteData.user?.id
    if (authUserId) {
      const { error: profileError } = await serviceClient.from("users").insert({
        id: authUserId,
        tenant_id: tenant.id,
        email: manager.email,
        full_name: manager.full_name,
        role: manager.role,
        status: "active",
        onboarding_completed: false,
      })

      if (profileError) {
        // Attempt to clean up the auth user to avoid orphaned invite
        await serviceClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return NextResponse.json(
          {
            data: tenant,
            warning: `Empresa criada, mas falha ao criar perfil do gestor: ${profileError.message}`,
          },
          { status: 201 },
        )
      }
    }

    await logSuperAdminAction(user.id, "invite_manager", "user", authUserId || tenant.id, {
      email: manager.email,
      role: manager.role,
      tenant_id: tenant.id,
    })
  }

  return NextResponse.json({ data: tenant }, { status: 201 })
}
