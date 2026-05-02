import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auditCourse, type CourseForAudit, getModelWithFallback } from "@eximia/agents"
import { z } from "zod"

const bodySchema = z.object({
  courseId: z.string().uuid(),
})

/**
 * POST /api/course-designer/audit-course
 * Auditor — 7-step analysis of an existing course (Caminho B)
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // Role check
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Parse body
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "courseId inválido" }, { status: 400 })
  }

  // Fetch course with chapters and questions
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, description")
    .eq("id", body.courseId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, content, learning_objective, order")
    .eq("course_id", body.courseId)
    .order("order", { ascending: true })

  if (!chapters?.length) {
    return NextResponse.json(
      { error: "Curso não possui capítulos para auditar" },
      { status: 400 },
    )
  }

  // Fetch questions for each chapter
  const chapterIds = chapters.map((c) => c.id)
  const { data: questions } = await supabase
    .from("questions")
    .select("chapter_id, text, skill, expected_depth")
    .in("chapter_id", chapterIds)

  const questionsByChapter = (questions || []).reduce(
    (acc, q) => {
      if (!acc[q.chapter_id]) acc[q.chapter_id] = []
      acc[q.chapter_id].push({
        text: q.text,
        skill: q.skill,
        expectedDepth: q.expected_depth,
      })
      return acc
    },
    {} as Record<string, Array<{ text: string; skill: string | null; expectedDepth: string | null }>>,
  )

  const courseForAudit: CourseForAudit = {
    id: course.id,
    title: course.title,
    description: course.description,
    chapters: chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      content: ch.content,
      learningObjective: ch.learning_objective,
      order: ch.order,
      questions: questionsByChapter[ch.id] || [],
    })),
  }

  try {
    const model = getModelWithFallback({ agentRole: "mestre", tenantPlan: "standard" })
    const result = await auditCourse(courseForAudit, model)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: "Falha na auditoria", details: (err as Error).message },
      { status: 500 },
    )
  }
}
