import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireManager } from "../../../_guard-do-acervo"

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  chapter_order: z.number().int().min(0).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> },
) {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

  const { bookId, chapterId } = await params
  const body = await request.json()
  const parsed = updateChapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("book_chapters")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", chapterId)
    .eq("book_id", bookId)
    .eq("tenant_id", profile.tenant_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> },
) {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

  const { bookId, chapterId } = await params

  const { error } = await supabase
    .from("book_chapters")
    .delete()
    .eq("id", chapterId)
    .eq("book_id", bookId)
    .eq("tenant_id", profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
