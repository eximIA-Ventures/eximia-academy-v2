import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  author: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  cover_url: z.string().nullable().optional(),
  cover_color: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).optional(),
  year: z.number().int().nullable().optional(),
  pages: z.number().int().nullable().optional(),
  tags: z.array(z.string()).optional(),
  synopsis: z.string().nullable().optional(),
  author_bio: z.string().nullable().optional(),
  file_url: z.string().nullable().optional(),
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { bookId } = await params

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { bookId } = await params
  const body = await request.json()
  const parsed = updateBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("books")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("tenant_id", profile.tenant_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { bookId } = await params

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("tenant_id", profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
