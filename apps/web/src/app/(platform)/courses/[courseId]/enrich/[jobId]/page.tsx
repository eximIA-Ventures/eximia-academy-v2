import { createClient } from "@/lib/supabase/server"
import { getDbClient } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { EnrichmentReviewClient } from "./_components/enrichment-review-client"

interface EnrichmentReviewPageProps {
  params: Promise<{ courseId: string; jobId: string }>
}

export default async function EnrichmentReviewPage({ params }: EnrichmentReviewPageProps) {
  const { courseId, jobId } = await params
  const supabase = await getDbClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin"].includes(profile.role)) return redirect("/courses")

  // Fetch course
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single()

  if (!course) notFound()

  // Fetch job
  const { data: job } = await supabase.from("enrichment_jobs").select("*").eq("id", jobId).single()

  if (!job) notFound()

  // Fetch sources with chapter info
  const { data: sources } = await supabase
    .from("enrichment_sources")
    .select("*")
    .eq("job_id", jobId)
    .order("chapter_id")

  // Fetch chapter titles
  const chapterIds = [...new Set((sources ?? []).map((s) => s.chapter_id))]
  let chapters: Array<{ id: string; title: string }> = []
  if (chapterIds.length > 0) {
    const { data: chaptersData } = await supabase
      .from("chapters")
      .select("id, title")
      .in("id", chapterIds)

    chapters = chaptersData ?? []
  }

  return (
    <EnrichmentReviewClient course={course} job={job} sources={sources ?? []} chapters={chapters} />
  )
}
