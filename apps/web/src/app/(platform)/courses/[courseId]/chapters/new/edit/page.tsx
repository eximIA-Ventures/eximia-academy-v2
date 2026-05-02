import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { ChapterEditorClient } from "../../[chapterId]/edit/_components/chapter-editor-client"

interface NewChapterPageProps {
  params: Promise<{ courseId: string }>
}

export default async function NewChapterPage({ params }: NewChapterPageProps) {
  const { courseId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

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

  return (
    <ChapterEditorClient
      courseId={courseId}
      courseTitle={course?.title ?? "Curso"}
      tenantId={(profile?.tenant_id as string) ?? ""}
    />
  )
}
