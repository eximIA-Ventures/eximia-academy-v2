import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireManager } from "../../_guard-do-acervo"

const chapterSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  content: z.string().default(""),
  content_type: z.enum(["chapter", "summary"]),
  chapter_order: z.number().int().min(0),
})

export async function GET(_request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

  const { bookId } = await params

  const { data, error } = await supabase
    .from("book_chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("tenant_id", profile.tenant_id)
    .order("content_type")
    .order("chapter_order")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

  const { bookId } = await params
  const body = await request.json()
  const parsed = chapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("book_chapters")
    .insert({
      ...parsed.data,
      book_id: bookId,
      tenant_id: profile.tenant_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
