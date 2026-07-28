import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

/* --------------------------------- Schemas -------------------------------- */

const patchSchema = z.object({
  role: z.enum(["student", "leader", "manager", "admin", "instructor"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  reportsTo: z.string().uuid().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
})

/* --------------------------------- Helpers -------------------------------- */

async function getAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role))
    return { user, profile: null }

  return { user, profile }
}

// Resolve the caller's tenant: admin/super_admin with null tenant uses cookie
async function resolveTenantId(tenantId: string | null): Promise<string | null> {
  if (tenantId) return tenantId
  const { cookies: getCookies } = await import("next/headers")
  const cookieStore = await getCookies()
  return cookieStore.get("x-sa-active-tenant")?.value ?? null
}

const USER_SELECT =
  "id, full_name, email, role, status, avatar_url, created_at, reports_to, job_role_id"

/* ---------------------------------- PATCH --------------------------------- */

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await getAdminProfile(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const updates = parsed.data

  // Business rule: admin cannot demote themselves
  if (
    userId === profile.id &&
    profile.role === "admin" &&
    updates.role &&
    updates.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Você nao pode remover seu proprio papel de administrador." },
      { status: 400 },
    )
  }

  // Business rule: only admin can assign admin role
  if (updates.role === "admin" && profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem atribuir o papel de admin." },
      { status: 403 },
    )
  }

  // Business rule: nobody can be their own superior
  if (updates.reportsTo !== undefined && updates.reportsTo === userId) {
    return NextResponse.json(
      { error: "Um usuário nao pode ser superior de si mesmo." },
      { status: 400 },
    )
  }

  // Tenant-scoped validations for organizational fields
  if (updates.reportsTo !== undefined || updates.jobRoleId !== undefined) {
    const tenantId = await resolveTenantId(profile.tenant_id)
    if (!tenantId) {
      return NextResponse.json(
        { error: "Nenhum tenant ativo. Selecione um tenant primeiro." },
        { status: 400 },
      )
    }

    // Target must belong to the caller's tenant
    const { data: target } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("id", userId)
      .single()

    if (!target || target.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Usuário nao encontrado." }, { status: 404 })
    }

    // Superior must exist in the same tenant
    if (updates.reportsTo) {
      const { data: superior } = await supabase
        .from("users")
        .select("id, tenant_id")
        .eq("id", updates.reportsTo)
        .single()

      if (!superior || superior.tenant_id !== tenantId) {
        return NextResponse.json(
          { error: "Superior imediato invalido: usuário nao pertence a este tenant." },
          { status: 400 },
        )
      }
    }

    // Job role must exist in the same tenant
    if (updates.jobRoleId) {
      const { data: jobRole } = await supabase
        .from("job_roles")
        .select("id, tenant_id")
        .eq("id", updates.jobRoleId)
        .single()

      if (!jobRole || jobRole.tenant_id !== tenantId) {
        return NextResponse.json(
          { error: "Cargo invalido: nao pertence a este tenant." },
          { status: 400 },
        )
      }
    }
  }

  // Build update payload (only include defined fields).
  // reports_to/job_role_id are updated via the Supabase client directly while
  // the Drizzle schema catches up with the existing DB columns (CFG-0.1 A1).
  const payload: Record<string, string | null> = {}
  if (updates.role !== undefined) payload.role = updates.role
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.reportsTo !== undefined) payload.reports_to = updates.reportsTo
  if (updates.jobRoleId !== undefined) payload.job_role_id = updates.jobRoleId

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 })
  }

  // RLS ensures tenant isolation — the authenticated client can only update
  // users within the same tenant_id
  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select(USER_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actorId: profile.id,
    tenantId: await resolveTenantId(profile.tenant_id),
    action: "user.updated",
    targetType: "user",
    targetId: userId,
    details: { changes: payload },
  })

  return NextResponse.json({ data })
}

/* --------------------------------- DELETE --------------------------------- */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await getAdminProfile(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params

  // Prevent admin from deactivating themselves
  if (userId === profile.id) {
    return NextResponse.json(
      { error: "Você nao pode desativar sua propria conta." },
      { status: 400 },
    )
  }

  // Soft delete: set status to inactive
  const { data, error } = await supabase
    .from("users")
    .update({ status: "inactive" })
    .eq("id", userId)
    .select(USER_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actorId: profile.id,
    tenantId: await resolveTenantId(profile.tenant_id),
    action: "user.deactivated",
    targetType: "user",
    targetId: userId,
  })

  return NextResponse.json({ data })
}
