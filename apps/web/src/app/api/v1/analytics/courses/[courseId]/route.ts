import { getV1Context, unauthorizedResponse } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { courseId } = await params

  // Verify course belongs to tenant
  const { data: course } = await ctx.serviceClient
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!course) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  // Aggregate enrollment stats
  const { data: enrollments, error: enrollError } = await ctx.serviceClient
    .from("enrollments")
    .select("id, status")
    .eq("course_id", courseId)
    .eq("tenant_id", ctx.tenantId)

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 })
  }

  const total = enrollments?.length ?? 0
  const active = enrollments?.filter((e) => e.status === "active").length ?? 0
  const completed = enrollments?.filter((e) => e.status === "completed").length ?? 0
  const dropped = enrollments?.filter((e) => e.status === "dropped").length ?? 0

  // Chapter count
  const { count: chapterCount } = await ctx.serviceClient
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)

  return NextResponse.json({
    data: {
      course_id: courseId,
      course_title: course.title,
      chapters: chapterCount ?? 0,
      enrollments: {
        total,
        active,
        completed,
        dropped,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    },
  })
}
