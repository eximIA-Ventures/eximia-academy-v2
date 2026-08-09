import { getDbClient } from "@/lib/auth"
import { requireCourseManager } from "@/lib/course-management-guard"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChapterIngestionWizard } from "./_components/chapter-ingestion-wizard"

interface ChapterIngestPageProps {
  params: Promise<{ courseId: string }>
}

export default async function ChapterIngestPage({ params }: ChapterIngestPageProps) {
  const { courseId } = await params
  const supabase = await getDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // "Adicionar Capítulo" is course management (fix-manager-privacy-gates,
  // Correção 2) — instructor/admin hat required, manager-only hat is denied.
  const roleCheck = await requireCourseManager(supabase, user.id)
  if (!roleCheck.ok) {
    return redirect(`/courses/${courseId}`)
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/courses" className="hover:text-text-secondary">
          Cursos
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-text-secondary">
          {course?.title ?? "Curso"}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}/chapters/new`} className="hover:text-text-secondary">
          Novo Capítulo
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Importar com IA</span>
      </nav>
      <ChapterIngestionWizard courseId={courseId} />
    </div>
  )
}
