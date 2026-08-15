import { NextResponse } from "next/server"
import { courseDesignerCrudLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/courses?forDesigner=true
 * Lista cursos do tenant para o Course Selector do Course Designer (Caminho B).
 * story-23.4 AC4 — id, title, chapters_count, questions_count, status, created_at.
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  if (courseDesignerCrudLimiter) {
    const { success } = await courseDesignerCrudLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, description, status, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Erro ao listar cursos" }, { status: 500 })
  }

  if (!courses?.length) {
    return NextResponse.json({ courses: [] })
  }

  const courseIds = courses.map((c) => c.id)

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, course_id")
    .in("course_id", courseIds)

  const chapterIds = (chapters ?? []).map((ch) => ch.id)

  let questions: { chapter_id: string }[] = []
  if (chapterIds.length) {
    const { data } = await supabase.from("questions").select("chapter_id").in("chapter_id", chapterIds)
    questions = data ?? []
  }

  const chapterToCourse = new Map((chapters ?? []).map((ch) => [ch.id, ch.course_id]))

  const chaptersCountByCourse = new Map<string, number>()
  for (const ch of chapters ?? []) {
    chaptersCountByCourse.set(ch.course_id, (chaptersCountByCourse.get(ch.course_id) ?? 0) + 1)
  }

  const questionsCountByCourse = new Map<string, number>()
  for (const q of questions) {
    const courseId = chapterToCourse.get(q.chapter_id)
    if (!courseId) continue
    questionsCountByCourse.set(courseId, (questionsCountByCourse.get(courseId) ?? 0) + 1)
  }

  return NextResponse.json({
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      created_at: c.created_at,
      chapters_count: chaptersCountByCourse.get(c.id) ?? 0,
      questions_count: questionsCountByCourse.get(c.id) ?? 0,
    })),
  })
}
