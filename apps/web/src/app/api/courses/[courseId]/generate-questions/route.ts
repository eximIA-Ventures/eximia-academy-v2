export const maxDuration = 300 // 5 min for batch question generation

import { startBatchGeneration } from "@/lib/question-generation"
import { batchQuestionGenLimiter } from "@/lib/rate-limit"
import { setSentryContext } from "@/lib/sentry"
import { createClient } from "@/lib/supabase/server"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ courseId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { courseId } = await context.params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    setSentryContext(user.id, "", `/api/courses/${courseId}/generate-questions`)

    // Role guard
    const { data: profile } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
    }

    // Rate limiting: 1 batch per course per 5 minutes
    if (batchQuestionGenLimiter) {
      const { success } = await batchQuestionGenLimiter.limit(`course:${courseId}`)
      if (!success) {
        return NextResponse.json(
          { error: "Aguarde 5 minutos antes de gerar novamente para este curso" },
          { status: 429 },
        )
      }
    }

    const result = await startBatchGeneration({
      courseId,
      tenantId: profile.tenant_id,
      triggeredBy: user.id,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    if (result.skipped) {
      const messages: Record<string, string> = {
        no_published_chapters: "Nenhum capítulo publicado neste curso",
        all_chapters_have_questions: "Todos os capítulos já possuem perguntas ativas",
        job_already_in_progress: "Ja existe um job de geração em andamento para este curso",
      }
      const status = result.reason === "job_already_in_progress" ? 409 : 400
      return NextResponse.json(
        { message: messages[result.reason] ?? "Operacao ignorada", jobId: null },
        { status },
      )
    }

    return NextResponse.json(
      {
        jobId: result.jobId,
        chaptersToProcess: result.chaptersToProcess,
        message: `Gerando perguntas para ${result.chaptersToProcess} capítulo(s)...`,
      },
      { status: 202 },
    )
  } catch (err) {
    Sentry.captureException(err, {
      tags: { course_id: courseId, route: "batch-generate-questions" },
    })
    console.error("Batch generate questions error:", err)
    return NextResponse.json({ error: "Erro interno ao gerar perguntas" }, { status: 500 })
  }
}
