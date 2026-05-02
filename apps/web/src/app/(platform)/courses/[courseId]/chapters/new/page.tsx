import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChapterModeSelector } from "./_components/chapter-mode-selector"

interface NewChapterModePage {
  params: Promise<{ courseId: string }>
}

export default async function NewChapterModePage({ params }: NewChapterModePage) {
  const { courseId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin"].includes(profile.role)) {
    return redirect(`/courses/${courseId}`)
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/courses" className="hover:text-text-secondary">
          Cursos
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-text-secondary">
          {course?.title ?? "Curso"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Novo Capítulo</span>
      </nav>
      <h1 className="mt-3 text-xl font-bold text-text-primary">Novo Capítulo</h1>
      <p className="mt-1 text-sm text-text-secondary">Escolha como deseja criar seu capítulo.</p>
      <ChapterModeSelector courseId={courseId} />
    </div>
  )
}
