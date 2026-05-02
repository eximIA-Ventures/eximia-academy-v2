import { startEnrichment } from "@/lib/course-enrichment"
import { enrichmentLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ courseId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { courseId } = await context.params

  try {
    // Auth guard
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Role guard
    const { data: profile } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
    }

    // Rate limit
    if (enrichmentLimiter) {
      const { success } = await enrichmentLimiter.limit(courseId)
      if (!success) {
        return NextResponse.json(
          { error: "Aguarde alguns minutos antes de enriquecer novamente" },
          { status: 429 },
        )
      }
    }

    // Verify course exists and belongs to tenant
    const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).single()

    if (!course) {
      return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
    }

    const result = await startEnrichment({
      courseId,
      tenantId: profile.tenant_id,
      triggeredBy: user.id,
    })

    if ("skipped" in result && result.skipped) {
      const messages: Record<string, string> = {
        no_published_chapters: "Nenhum capítulo publicado encontrado",
        job_already_in_progress: "Ja existe um enriquecimento em andamento",
      }
      return NextResponse.json(
        { error: messages[result.reason] ?? "Operacao ignorada" },
        { status: 409 },
      )
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(
      { jobId: result.jobId, chaptersToProcess: result.chaptersToProcess },
      { status: 202 },
    )
  } catch (err) {
    Sentry.captureException(err, {
      tags: { course_id: courseId, route: "enrich" },
    })
    console.error("Enrich route error:", err)
    return NextResponse.json({ error: "Erro interno ao iniciar enriquecimento" }, { status: 500 })
  }
}
