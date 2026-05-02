import { logSuperAdminAction } from "@/lib/audit"
import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

/* --------------------------------- Schemas -------------------------------- */

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(1, "Nome obrigatório"),
  role: z.enum(["student", "manager", "admin"]),
})

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from("users")
    .select("id, full_name, email, role, status, avatar_url, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  return NextResponse.json({ data: items, nextCursor })
}

/* ---------------------------------- POST ---------------------------------- */

export async function POST(
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
  const parsed = inviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Verify tenant exists
  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
  }

  // Invite user
  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        tenant_id: tenantId,
        role: parsed.data.role,
        full_name: parsed.data.full_name,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
    },
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  // Create user profile
  const authUserId = inviteData.user?.id
  if (authUserId) {
    const { error: profileError } = await serviceClient.from("users").insert({
      id: authUserId,
      tenant_id: tenantId,
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      status: "active",
      onboarding_completed: false,
    })

    if (profileError) {
      return NextResponse.json(
        { error: `Convite enviado, mas falha ao criar perfil: ${profileError.message}` },
        { status: 500 },
      )
    }
  }

  await logSuperAdminAction(user.id, "invite_user_to_tenant", "user", authUserId || tenantId, {
    email: parsed.data.email,
    role: parsed.data.role,
    tenant_id: tenantId,
  })

  return NextResponse.json({
    data: {
      user_id: inviteData.user?.id,
      email: parsed.data.email,
    },
  }, { status: 201 })
}
