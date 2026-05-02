import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { computeProportionalTimestamps } from "@/lib/audio-sync"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
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

  // Get chapter
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, tenant_id, slide_audio_url, audio_url")
    .eq("id", chapterId)
    .single()

  if (!chapter || chapter.tenant_id !== profile.tenant_id)
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })

  // Parse body — expects totalDurationMs
  const body = await request.json().catch(() => ({}))
  const totalDurationMs = body.totalDurationMs as number | undefined

  if (!totalDurationMs || totalDurationMs <= 0)
    return NextResponse.json(
      { error: "totalDurationMs is required and must be positive" },
      { status: 400 },
    )

  // Fetch slides
  const service = createServiceClient()
  const { data: slides } = await service
    .from("chapter_slides")
    .select("id, order, text_content")
    .eq("chapter_id", chapterId)
    .order("order", { ascending: true })

  if (!slides || slides.length === 0)
    return NextResponse.json({ error: "No slides found" }, { status: 400 })

  // Compute timestamps
  const timestamps = computeProportionalTimestamps(
    slides.map((s) => ({
      id: s.id as string,
      order: s.order as number,
      text_content: s.text_content as string | null,
    })),
    totalDurationMs,
  )

  // Update each slide with its timestamps
  for (const ts of timestamps) {
    await service
      .from("chapter_slides")
      .update({
        audio_start_ms: ts.audioStartMs,
        audio_end_ms: ts.audioEndMs,
      })
      .eq("id", ts.slideId)
  }

  return NextResponse.json({
    success: true,
    slidesUpdated: timestamps.length,
    timestamps,
  })
}
