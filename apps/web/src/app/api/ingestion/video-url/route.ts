import { extractYouTubeTranscript, isYouTubeUrl } from "@/lib/extractors"
import { ingestionLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

const videoUrlSchema = z.object({
  url: z.string().url("URL invalida."),
  title: z.string().max(200).optional(),
  course_id: z.string().uuid().optional(),
})

export async function POST(request: Request) {
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

    // Rate limiting
    if (ingestionLimiter) {
      const { success } = await ingestionLimiter.limit(user.id)
      if (!success) {
        return NextResponse.json(
          { error: "Muitas solicitacoes. Aguarde alguns minutos." },
          { status: 429 },
        )
      }
    }

    // Parse and validate body
    const body = await request.json()
    const parsed = videoUrlSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors[0].message
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { url, title, course_id } = parsed.data

    // Validate YouTube URL
    if (!isYouTubeUrl(url)) {
      return NextResponse.json(
        {
          error:
            "URL do YouTube inválida ou vídeo indisponivel. Use links youtube.com ou youtu.be.",
        },
        { status: 400 },
      )
    }

    const serviceClient = createServiceClient()
    const tenantId = profile.tenant_id

    // Create ingestion record
    const { data: ingestion, error: insertError } = await serviceClient
      .from("content_ingestions")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        source_type: "video_url",
        source_url: url,
        source_filename: title || url,
        status: "extracting",
        ...(course_id ? { course_id } : {}),
        processing_metadata: {
          step: "Extraindo legendas do vídeo...",
          title: title || url,
        },
      })
      .select("id")
      .single()

    if (insertError || !ingestion) {
      console.error("Error creating video-url ingestion:", insertError)
      return NextResponse.json({ error: "Erro ao registrar vídeo." }, { status: 500 })
    }

    const ingestionId = ingestion.id

    // Extract transcript
    let rawText: string
    try {
      rawText = await extractYouTubeTranscript(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao extrair conteúdo do vídeo."
      await serviceClient
        .from("content_ingestions")
        .update({ status: "failed", error_message: message })
        .eq("id", ingestionId)
      return NextResponse.json({ error: message }, { status: 422 })
    }

    // Validate minimum text length
    if (rawText.trim().length < 200) {
      await serviceClient
        .from("content_ingestions")
        .update({
          status: "failed",
          raw_text: rawText,
          error_message: "Conteúdo do vídeo muito curto. Minimo de 200 caracteres.",
        })
        .eq("id", ingestionId)
      return NextResponse.json(
        { error: "Conteúdo do vídeo muito curto. Minimo de 200 caracteres." },
        { status: 422 },
      )
    }

    // Save raw text and update to 'processing'
    await serviceClient
      .from("content_ingestions")
      .update({
        raw_text: rawText,
        status: "processing",
        processing_metadata: {
          title: title || url,
          extracted_chars: rawText.length,
          extracted_at: new Date().toISOString(),
          source: "youtube_captions",
        },
      })
      .eq("id", ingestionId)

    return NextResponse.json({
      ingestionId,
      status: "processing",
      extractedChars: rawText.length,
    })
  } catch (err) {
    console.error("Ingestion video-url error:", err)
    return NextResponse.json({ error: "Erro interno ao processar vídeo." }, { status: 500 })
  }
}
