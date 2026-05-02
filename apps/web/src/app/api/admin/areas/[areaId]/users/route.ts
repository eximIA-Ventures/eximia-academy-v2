import { requireAdminOrManager } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const addUserSchema = z.object({
  user_id: z.string().uuid(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ areaId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdminOrManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { areaId } = await params

  const { data, error } = await supabase
    .from("user_areas")
    .select("user_id, users(id, full_name, email, role)")
    .eq("area_id", areaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data ?? []).map((row) => {
    const u = row.users as unknown as { id: string; full_name: string; email: string; role: string }
    return { id: u.id, full_name: u.full_name, email: u.email, role: u.role }
  })

  return NextResponse.json({ data: users })
}

export async function POST(request: Request, { params }: { params: Promise<{ areaId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdminOrManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { areaId } = await params
  const body = await request.json()
  const parsed = addUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { error } = await supabase.from("user_areas").insert({
    user_id: parsed.data.user_id,
    area_id: areaId,
  })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Usuário já pertence a esta área" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdminOrManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { areaId } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("user_id")

  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_areas")
    .delete()
    .eq("area_id", areaId)
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
