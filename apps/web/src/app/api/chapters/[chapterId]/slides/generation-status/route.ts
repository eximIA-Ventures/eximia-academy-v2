import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get counts by status
  const { data: slides } = await supabase
    .from("chapter_slides")
    .select("id, text_status")
    .eq("chapter_id", chapterId)

  if (!slides) return NextResponse.json({ error: "No slides found" }, { status: 404 })

  const total = slides.length
  const pending = slides.filter((s) => s.text_status === "pending").length
  const generating = slides.filter((s) => s.text_status === "generating").length
  const review = slides.filter((s) => s.text_status === "review").length
  const approved = slides.filter((s) => s.text_status === "approved").length

  const isComplete = generating === 0 && pending === 0
  const progress = total > 0 ? Math.round(((review + approved) / total) * 100) : 0

  return NextResponse.json({
    total,
    pending,
    generating,
    review,
    approved,
    isComplete,
    progress,
  })
}
