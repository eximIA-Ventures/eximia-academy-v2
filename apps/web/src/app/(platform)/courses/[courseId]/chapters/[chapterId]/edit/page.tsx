import { createClient } from "@/lib/supabase/server"
import type { ChapterSlide } from "@eximia/shared"
import { tenantRedirect } from "@/lib/tenant-nav"
import { notFound, redirect } from "next/navigation"
import { ChapterEditorClient } from "./_components/chapter-editor-client"

interface ChapterEditPageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function ChapterEditPage({ params }: ChapterEditPageProps) {
  const { courseId, chapterId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: chapter } = await supabase.from("chapters").select("*").eq("id", chapterId).single()

  if (!chapter) notFound()

  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single()

  // Fetch tenant_id for asset uploads
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()

  // Fetch slides for this chapter (Slide Integration)
  const { data: slidesData } = await supabase
    .from("chapter_slides")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("order", { ascending: true })

  const slides = (slidesData ?? []) as ChapterSlide[]

  return (
    <ChapterEditorClient
      courseId={courseId}
      courseTitle={course?.title ?? "Curso"}
      tenantId={(profile?.tenant_id as string) ?? ""}
      chapter={{
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        content_blocks: (chapter.content_blocks as Record<string, unknown>[] | null) ?? null,
        learning_objective: chapter.learning_objective,
        status: chapter.status,
        video_url: chapter.video_url,
        audio_url: chapter.audio_url,
        slide_audio_url: (chapter.slide_audio_url as string | null) ?? null,
      }}
      slides={slides}
    />
  )
}
