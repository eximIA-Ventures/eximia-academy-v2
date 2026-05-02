import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

/* --------------------------------- Schemas -------------------------------- */

const patchSchema = z.object({
  role: z.enum(["student", "manager", "admin", "instructor"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
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

  // Build update payload (only include defined fields)
  const payload: Record<string, string> = {}
  if (updates.role !== undefined) payload.role = updates.role
  if (updates.status !== undefined) payload.status = updates.status

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 })
  }

  // RLS ensures tenant isolation — the authenticated client can only update
  // users within the same tenant_id
  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select("id, full_name, email, role, status, avatar_url, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
    .select("id, full_name, email, role, status, avatar_url, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
