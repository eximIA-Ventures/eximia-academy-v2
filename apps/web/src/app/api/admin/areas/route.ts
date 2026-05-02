import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const createAreaSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  description: z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("areas")
    .select("id, name, slug, description, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count users per area
  const areas = await Promise.all(
    (data ?? []).map(async (area) => {
      const { count } = await supabase
        .from("user_areas")
        .select("id", { count: "exact", head: true })
        .eq("area_id", area.id)

      const { count: courseCount } = await supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("area_id", area.id)

      return { ...area, user_count: count ?? 0, course_count: courseCount ?? 0 }
    }),
  )

  return NextResponse.json({ data: areas })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createAreaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("areas")
    .insert({
      tenant_id: profile.tenant_id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma área com este slug" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
