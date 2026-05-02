import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PresentationViewer } from "./_components/presentation-viewer"

interface PageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function PresentPage({ params }: PageProps) {
  const { courseId, chapterId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Accessible to all authenticated users (students included)
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile) return redirect(`/courses/${courseId}/chapters/${chapterId}`)

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, slide_audio_url, audio_url")
    .eq("id", chapterId)
    .single()

  if (!chapter) redirect(`/courses/${courseId}`)

  const { data: slides } = await supabase
    .from("chapter_slides")
    .select("id, order, image_url, text_content, audio_start_ms, audio_end_ms")
    .eq("chapter_id", chapterId)
    .order("order")

  const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).single()

  return (
    <PresentationViewer
      courseTitle={course?.title ?? ""}
      chapterTitle={chapter.title}
      slides={slides ?? []}
      audioUrl={chapter.slide_audio_url ?? chapter.audio_url ?? null}
      backUrl={`/courses/${courseId}/chapters/${chapterId}`}
    />
  )
}
