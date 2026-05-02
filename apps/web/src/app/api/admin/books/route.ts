import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const bookSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  author: z.string().min(1, "Autor obrigatório").max(200),
  category: z.string().min(1).max(50),
  description: z.string().optional(),
  cover_url: z.string().optional(),
  cover_color: z.string().optional(),
  rating: z.number().min(0).max(5).default(0),
  year: z.number().int().optional(),
  pages: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
  synopsis: z.string().optional(),
  author_bio: z.string().optional(),
  file_url: z.string().optional(),
})

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
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

export async function GET() {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("title")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("books")
    .insert({
      ...parsed.data,
      tenant_id: profile.tenant_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
