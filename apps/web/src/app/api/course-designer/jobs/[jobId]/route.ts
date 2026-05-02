import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/course-designer/jobs/[jobId]
 * DB fallback for job status polling.
 * Returns current phase, status, phase_results (if completed), error (if failed).
 */
export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params

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

  const { data: job, error } = await supabase
    .from("blueprint_generation_jobs")
    .select(
      "id, status, current_phase, progress, phase_results, blueprint_id, error_message, started_at, completed_at, created_at, updated_at",
    )
    .eq("id", jobId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    current_phase: job.current_phase,
    progress: job.progress,
    blueprint_id: job.blueprint_id,
    error_message: job.error_message,
    phase_results: job.status === "completed" ? job.phase_results : undefined,
    started_at: job.started_at,
    completed_at: job.completed_at,
    created_at: job.created_at,
  })
}
