import { startEnrichment } from "@/lib/course-enrichment"
import { requireCourseManager } from "@/lib/course-management-guard"
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

    // Role guard (fix-manager-privacy-gates) — instructor/admin hat required,
    // manager-only hat is denied.
    const roleCheck = await requireCourseManager(supabase, user.id)
    if (!roleCheck.ok) {
      return NextResponse.json({ error: roleCheck.error }, { status: 403 })
    }
    const tenantId = roleCheck.ctx.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant não resolvido" }, { status: 400 })
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
      tenantId,
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
