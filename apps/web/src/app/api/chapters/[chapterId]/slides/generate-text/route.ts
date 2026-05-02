import { createClient } from "@/lib/supabase/server"
import { generateTextsForChapterSlides } from "@/lib/slide-text-generator"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params

  // Auth + role check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "manager", "instructor"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Verify chapter exists and belongs to tenant
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, tenant_id")
    .eq("id", chapterId)
    .single()

  if (!chapter || chapter.tenant_id !== profile.tenant_id)
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })

  // Check if slides exist
  const { count } = await supabase
    .from("chapter_slides")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)

  if (!count || count === 0)
    return NextResponse.json({ error: "No slides found" }, { status: 400 })

  // Run generation (async but we wait for completion)
  const result = await generateTextsForChapterSlides(chapterId)

  return NextResponse.json({
    success: true,
    processed: result.processed,
    errors: result.errors,
  })
}
