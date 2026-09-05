import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireManager } from "../../../_guard-do-acervo"

const reorderSchema = z.object({
  chapters: z.array(
    z.object({
      id: z.string().uuid(),
      chapter_order: z.number().int().min(0),
    }),
  ),
})

export async function POST(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const supabase = await createClient()
  const { profile, recusa } = await requireManager(supabase)
  if (recusa) return recusa

  const { bookId } = await params
  const body = await request.json()
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const updates = parsed.data.chapters.map((ch) =>
    supabase
      .from("book_chapters")
      .update({ chapter_order: ch.chapter_order, updated_at: new Date().toISOString() })
      .eq("id", ch.id)
      .eq("book_id", bookId)
      .eq("tenant_id", profile.tenant_id),
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
