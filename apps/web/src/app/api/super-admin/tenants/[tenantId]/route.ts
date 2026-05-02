import { logSuperAdminAction } from "@/lib/audit"
import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { updateTenantSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  const serviceClient = createServiceClient()

  // Fetch tenant
  const { data: tenant, error } = await serviceClient
    .from("tenants")
    .select("id, name, slug, plan, status, branding, settings, whitelabel_enabled, whitelabel_config, created_at, updated_at")
    .eq("id", tenantId)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
  }

  // Fetch user count + breakdown by role
  const { count: userCount } = await serviceClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  const { data: usersByRole } = await serviceClient
    .from("users")
    .select("role")
    .eq("tenant_id", tenantId)

  const roleCounts: Record<string, number> = {}
  for (const u of usersByRole ?? []) {
    roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1
  }

  // Sessions — total + completed + last 7 days + last 30 days
  const { count: sessionCount } = await serviceClient
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  const { count: completedSessions } = await serviceClient
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "completed")

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { count: sessions7d } = await serviceClient
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo)

  const { count: sessions30d } = await serviceClient
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo)

  // Courses
  const { count: courseCount } = await serviceClient
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  // Active users (users who had a session in last 7 days)
  const { data: activeUserData } = await serviceClient
    .from("sessions")
    .select("student_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo)

  const activeUsers7d = new Set((activeUserData ?? []).map((s) => s.student_id)).size

  // Enrollments
  const { count: enrollmentCount } = await serviceClient
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active")

  // Reflections count
  const { count: reflectionCount } = await serviceClient
    .from("slide_reflections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  return NextResponse.json({
    data: {
      ...tenant,
      stats: {
        user_count: userCount ?? 0,
        users_by_role: roleCounts,
        session_count: sessionCount ?? 0,
        sessions_completed: completedSessions ?? 0,
        sessions_7d: sessions7d ?? 0,
        sessions_30d: sessions30d ?? 0,
        active_users_7d: activeUsers7d,
        course_count: courseCount ?? 0,
        enrollment_count: enrollmentCount ?? 0,
        reflection_count: reflectionCount ?? 0,
      },
    },
  })
}

/* ---------------------------------- PATCH --------------------------------- */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = updateTenantSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Build update payload (only include defined fields)
  const payload: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) payload.name = parsed.data.name
  if (parsed.data.plan !== undefined) payload.plan = parsed.data.plan
  if (parsed.data.status !== undefined) payload.status = parsed.data.status
  if (parsed.data.whitelabel_enabled !== undefined)
    payload.whitelabel_enabled = parsed.data.whitelabel_enabled
  if (parsed.data.whitelabel_config !== undefined)
    payload.whitelabel_config = parsed.data.whitelabel_config
  if (parsed.data.settings !== undefined) {
    // Merge with existing settings to avoid overwriting
    const { data: existing } = await serviceClient
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single()
    const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
    payload.settings = { ...currentSettings, ...parsed.data.settings }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 })
  }

  const { data: tenant, error } = await serviceClient
    .from("tenants")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", tenantId)
    .select("id, name, slug, plan, status, branding, settings, whitelabel_enabled, whitelabel_config, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!tenant) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
  }

  await logSuperAdminAction(user.id, "update_tenant", "tenant", tenantId, {
    fields_updated: Object.keys(payload),
  })

  return NextResponse.json({ data: tenant })
}
