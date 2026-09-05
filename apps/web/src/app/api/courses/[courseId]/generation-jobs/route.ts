import { requireRole } from "@/lib/api-role-guard"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ courseId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { courseId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // Role guard
  const { recusa } = await requireRole(supabase, user.id, ["manager", "admin", "instructor"])
  if (recusa) return recusa

  const { data: jobs, error } = await supabase
    .from("question_generation_jobs")
    .select(
      "id, status, scope, progress, questions_generated, questions_approved, questions_rejected, error_message, created_at, updated_at",
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar jobs" }, { status: 500 })
  }

  return NextResponse.json({ jobs: jobs ?? [] })
}
