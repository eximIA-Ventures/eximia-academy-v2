export const maxDuration = 300 // 5 min — organizer may take long on large docs

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { organizeContent } from "@eximia/agents"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id: ingestionId } = await context.params

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

    const serviceClient = createServiceClient()

    // Fetch ingestion record
    const { data: ingestion } = await serviceClient
      .from("content_ingestions")
      .select(
        "id, raw_text, source_type, source_filename, status, tenant_id, course_id, processing_metadata",
      )
      .eq("id", ingestionId)
      .eq("tenant_id", profile.tenant_id)
      .single()

    if (!ingestion) {
      return NextResponse.json({ error: "Ingestao não encontrada." }, { status: 404 })
    }

    // Accept "processing" (first run) or "review" (regeneration)
    if (!["processing", "review"].includes(ingestion.status)) {
      return NextResponse.json(
        { error: `Status inválido para processamento: ${ingestion.status}` },
        { status: 400 },
      )
    }

    // For regeneration, reset status to processing
    if (ingestion.status === "review") {
      await serviceClient
        .from("content_ingestions")
        .update({ status: "processing" })
        .eq("id", ingestionId)
    }

    if (!ingestion.raw_text || ingestion.raw_text.trim().length < 200) {
      return NextResponse.json({ error: "Texto insuficiente para processamento." }, { status: 400 })
    }

    // Parse optional instructions from request body
    let instructions: string | undefined
    try {
      const body = await request.json()
      instructions = body.instructions
    } catch {
      // No body — that's fine
    }

    // Update status to show AI processing step
    await serviceClient
      .from("content_ingestions")
      .update({
        processing_metadata: {
          ...(ingestion.processing_metadata as Record<string, unknown> | null),
          step: "Organizando conteúdo com IA...",
          ai_started_at: new Date().toISOString(),
        },
      })
      .eq("id", ingestionId)

    // Call organizer agent
    const metadata = ingestion.processing_metadata as Record<string, unknown> | null
    const title = (metadata?.title as string) || undefined

    try {
      const isChapterMode = !!ingestion.course_id
      const textLength = ingestion.raw_text?.length || 0

      // Dynamic max_chapters: scale with content size for large materials
      const dynamicMaxChapters = isChapterMode
        ? 1
        : textLength > 200_000
          ? 50
          : textLength > 100_000
            ? 40
            : textLength > 50_000
              ? 30
              : textLength > 25_000
                ? 20
                : 15

      const output = await organizeContent({
        raw_text: ingestion.raw_text,
        source_type: ingestion.source_type as
          | "pdf"
          | "docx"
          | "pptx"
          | "txt"
          | "audio"
          | "video_url"
          | "paste",
        source_filename: ingestion.source_filename || undefined,
        instructions: instructions || undefined,
        language: "pt-br",
        max_chapters: dynamicMaxChapters,
      })

      // Save AI output and update to 'review'
      await serviceClient
        .from("content_ingestions")
        .update({
          ai_output: output,
          status: "review",
          processing_metadata: {
            ...(metadata ?? {}),
            title: title || output.suggested_title,
            step: "Revisão disponivel",
            ai_completed_at: new Date().toISOString(),
            total_chapters: output.chapters.length,
          },
        })
        .eq("id", ingestionId)

      return NextResponse.json({
        status: "review",
        output,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao organizar conteúdo com IA. Tente novamente."
      await serviceClient
        .from("content_ingestions")
        .update({
          status: "failed",
          error_message: message,
          processing_metadata: {
            ...(metadata ?? {}),
            step: "Falha no processamento",
            ai_failed_at: new Date().toISOString(),
          },
        })
        .eq("id", ingestionId)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    console.error("Ingestion process error:", err)
    return NextResponse.json({ error: "Erro interno ao processar." }, { status: 500 })
  }
}
