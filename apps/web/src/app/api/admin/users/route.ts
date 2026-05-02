import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

/* --------------------------------- Schemas -------------------------------- */

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "manager", "admin", "instructor"]),
  full_name: z.string().min(1),
})

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve tenant_id: super_admin uses active tenant cookie
  const tenantId =
    profile.tenant_id ?? (profile.role === "super_admin" ? null : null)

  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)
  const role = searchParams.get("role")
  const rawSearch = searchParams.get("search")
  const search = rawSearch ? rawSearch.replace(/[%_,.()]/g, "") : null

  let query = supabase
    .from("users")
    .select("id, full_name, email, role, status, avatar_url, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit + 1) // fetch one extra to determine if there's a next page

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  if (role) {
    query = query.eq("role", role)
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Area-scoped filtering: only return users that belong to a specific area
  const areaId = searchParams.get("area_id")
  if (areaId) {
    const { data: areaUsers } = await supabase
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaId)
    const userIds = (areaUsers ?? []).map((u) => u.user_id)
    if (userIds.length > 0) {
      query = query.in("id", userIds)
    } else {
      return NextResponse.json({ data: [], nextCursor: null })
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  // Fetch last_sign_in_at from Supabase Auth for these users
  const userIds = items.map((u) => u.id)
  const signInMap: Record<string, string | null> = {}
  if (userIds.length > 0) {
    const serviceClient = createServiceClient()
    const { data: authList } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    if (authList?.users) {
      for (const au of authList.users) {
        if (userIds.includes(au.id)) {
          signInMap[au.id] = au.last_sign_in_at ?? null
        }
      }
    }
  }

  const users = items.map((u) => ({
    ...u,
    last_sign_in_at: signInMap[u.id] ?? null,
  }))

  return NextResponse.json({ data: users, nextCursor })
}

/* ---------------------------------- POST ---------------------------------- */

export async function POST(request: Request) {
  // 1. Verify caller is admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve tenant_id: super_admin uses active tenant cookie
  const tenantId =
    profile.tenant_id ?? (profile.role === "super_admin" ? null : null)

  if (!tenantId) {
    return NextResponse.json(
      { error: "Nenhum tenant ativo. Selecione um tenant antes de convidar usuários." },
      { status: 400 },
    )
  }

  // 2. Validate body
  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  // 3. Invite via service role
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      tenant_id: tenantId,
      role: parsed.data.role,
      full_name: parsed.data.full_name,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // 4. Create user profile in public.users so they appear in the user list immediately
  const authUserId = data.user?.id
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

  return NextResponse.json({ data }, { status: 201 })
}
