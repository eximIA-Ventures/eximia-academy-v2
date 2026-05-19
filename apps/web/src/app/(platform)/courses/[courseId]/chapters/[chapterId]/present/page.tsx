import { getAuthProfile } from "@/lib/auth"
import { getDbClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PresentationViewer } from "./_components/presentation-viewer"

interface PageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function PresentPage({ params }: PageProps) {
  const { courseId, chapterId } = await params
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const supabase = await getDbClient()

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, slide_audio_url, audio_url, content")
    .eq("id", chapterId)
    .maybeSingle()

  if (!chapter) redirect(`/courses/${courseId}`)

  const { data: slides } = await supabase
    .from("chapter_slides")
    .select("id, order, image_url, text_content, audio_start_ms, audio_end_ms")
    .eq("chapter_id", chapterId)
    .order("order")

  const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle()

  return (
    <PresentationViewer
      courseTitle={course?.title ?? ""}
      chapterTitle={chapter.title}
      slides={slides ?? []}
      audioUrl={chapter.slide_audio_url ?? chapter.audio_url ?? null}
      podcastUrl={chapter.slide_audio_url ?? null}
      narrationUrl={chapter.audio_url ?? null}
      chapterId={chapterId}
      hasContent={!!chapter.content && chapter.content.trim().length > 50}
      backUrl={`/courses/${courseId}/chapters/${chapterId}`}
    />
  )
}
