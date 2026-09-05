import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireManager } from "./_guard-do-acervo"

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

export async function GET() {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

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
  const { user, profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

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
