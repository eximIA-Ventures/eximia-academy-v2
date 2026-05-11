import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CourseQuestionsOverview } from "./_components/course-questions-overview"

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseQuestionsPage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await getDbClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) return redirect("/courses")

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single()
  if (!course) return redirect("/courses")

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, status, interaction_type, bloom_target")
    .eq("course_id", courseId)
    .order("order")

  const chapterIds = chapters?.map((c) => c.id) ?? []

  const { data: questions } =
    chapterIds.length > 0
      ? await supabase
          .from("questions")
          .select(
            "id, chapter_id, text, skill, intention, expected_depth, status, job_id, created_at",
          )
          .in("chapter_id", chapterIds)
          .order("created_at")
      : { data: [] as never[] }

  const { data: activeJob } = await supabase
    .from("question_generation_jobs")
    .select("id, status, progress, questions_generated")
    .eq("course_id", courseId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <CourseQuestionsOverview
      course={course}
      chapters={chapters ?? []}
      questions={questions ?? []}
      activeJob={activeJob}
    />
  )
}
