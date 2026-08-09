import { getDbClient } from "@/lib/auth"
import { requireCourseManager } from "@/lib/course-management-guard"
import { notFound, redirect } from "next/navigation"
import { QuestionsReviewClient } from "./_components/questions-review-client"

interface QuestionsPageProps {
  params: Promise<{ courseId: string; chapterId: string }>
}

export default async function QuestionsPage({ params }: QuestionsPageProps) {
  const { courseId, chapterId } = await params
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Chapter-level question review is course management (fix-manager-privacy-gates,
  // Correção 2) — instructor/admin hat required, manager-only hat is denied.
  const roleCheck = await requireCourseManager(supabase, user.id)
  if (!roleCheck.ok) {
    return redirect("/courses")
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single()

  if (!course) notFound()

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, status")
    .eq("id", chapterId)
    .eq("course_id", courseId)
    .single()

  if (!chapter) notFound()

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: true })

  return (
    <QuestionsReviewClient
      courseId={course.id}
      courseTitle={course.title}
      chapterId={chapter.id}
      chapterTitle={chapter.title}
      chapterStatus={chapter.status}
      questions={(questions ?? []).map((q) => ({
        id: q.id,
        text: q.text,
        skill: q.skill,
        intention: q.intention,
        expected_depth: q.expected_depth,
        common_shallow_answer: q.common_shallow_answer,
        followup_prompts: q.followup_prompts ?? [],
        citations: q.citations ?? [],
        status: q.status,
        metadata: q.metadata ?? {},
      }))}
    />
  )
}
