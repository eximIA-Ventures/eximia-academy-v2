import { extractTextEnhanced, isAudioMime, transcribeAudio } from "@/lib/extractors"
import { ingestionLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

const uuidSchema = z.string().uuid()

const MIME_LIMITS: Record<string, { ext: string; sourceType: string; maxSize: number }> = {
  // Documents
  "application/pdf": { ext: "pdf", sourceType: "pdf", maxSize: 20 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    sourceType: "docx",
    maxSize: 10 * 1024 * 1024,
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    ext: "pptx",
    sourceType: "pptx",
    maxSize: 30 * 1024 * 1024,
  },
  "text/plain": { ext: "txt", sourceType: "txt", maxSize: 5 * 1024 * 1024 },
  "text/markdown": { ext: "txt", sourceType: "txt", maxSize: 5 * 1024 * 1024 },
  // Audio
  "audio/mpeg": { ext: "mp3", sourceType: "audio", maxSize: 50 * 1024 * 1024 },
  "audio/wav": { ext: "wav", sourceType: "audio", maxSize: 50 * 1024 * 1024 },
  "audio/mp4": { ext: "m4a", sourceType: "audio", maxSize: 50 * 1024 * 1024 },
  "audio/x-m4a": { ext: "m4a", sourceType: "audio", maxSize: 50 * 1024 * 1024 },
  "audio/ogg": { ext: "ogg", sourceType: "audio", maxSize: 50 * 1024 * 1024 },
}

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
          { error: "Muitas solicitacoes. Aguarde alguns minutos antes de enviar outro arquivo." },
          { status: 429 },
        )
      }
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string | null
    const rawCourseId = formData.get("course_id") as string | null
    const courseId = rawCourseId && uuidSchema.safeParse(rawCourseId).success ? rawCourseId : null

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 })
    }

    // Validate MIME type
    const mimeConfig = MIME_LIMITS[file.type]
    if (!mimeConfig) {
      return NextResponse.json(
        { error: "Formato nao suportado. Use PDF, DOCX, PPTX, TXT, MP3, WAV, M4A ou OGG." },
        { status: 400 },
      )
    }

    // Validate size
    if (file.size > mimeConfig.maxSize) {
      const limitMB = mimeConfig.maxSize / (1024 * 1024)
      return NextResponse.json(
        { error: `Arquivo muito grande. Limite maximo: ${limitMB}MB` },
        { status: 400 },
      )
    }

    const serviceClient = createServiceClient()
    const tenantId = profile.tenant_id

    // Create ingestion record with status='uploading'
    const { data: ingestion, error: insertError } = await serviceClient
      .from("content_ingestions")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        source_type: mimeConfig.sourceType,
        source_filename: file.name,
        source_size_bytes: file.size,
        status: "uploading",
        ...(courseId ? { course_id: courseId } : {}),
      })
      .select("id")
      .single()

    if (insertError || !ingestion) {
      console.error("Error creating ingestion record:", insertError)
      return NextResponse.json({ error: "Erro ao registrar upload." }, { status: 500 })
    }

    const ingestionId = ingestion.id

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `${tenantId}/ingestions/${ingestionId}/${file.name}`

    const { error: uploadError } = await serviceClient.storage
      .from("chapter-assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      await serviceClient
        .from("content_ingestions")
        .update({ status: "failed", error_message: "Falha no upload do arquivo." })
        .eq("id", ingestionId)
      return NextResponse.json({ error: "Falha no upload do arquivo." }, { status: 500 })
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = serviceClient.storage.from("chapter-assets").getPublicUrl(storagePath)

    // Update status to 'extracting'
    await serviceClient
      .from("content_ingestions")
      .update({
        source_url: publicUrl,
        status: "extracting",
        processing_metadata: isAudioMime(file.type)
          ? { step: "Transcrevendo audio...", title: title || file.name }
          : { step: "Extraindo texto...", title: title || file.name },
      })
      .eq("id", ingestionId)

    // Extract text — route audio to Whisper, documents to Docling (with legacy fallback)
    let rawText: string
    let extractorUsed: "docling" | "legacy" | "whisper" = "legacy"
    let extractionMeta: Record<string, unknown> = {}

    try {
      if (isAudioMime(file.type)) {
        rawText = await transcribeAudio(buffer, file.name)
        extractorUsed = "whisper"
      } else {
        const result = await extractTextEnhanced(buffer, file.type, file.name)
        rawText = result.text
        extractorUsed = result.extractor
        if (result.extractor === "docling") {
          extractionMeta = {
            docling_pages: result.pageCount,
            docling_tables: result.tableCount,
            docling_images: result.imageCount,
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Nao foi possivel ler o arquivo. Verifique se nao esta corrompido."
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
          error_message: "Conteúdo muito curto. Minimo de 200 caracteres.",
        })
        .eq("id", ingestionId)
      return NextResponse.json(
        { error: "Conteúdo muito curto. Minimo de 200 caracteres." },
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
          title: title || file.name,
          extracted_chars: rawText.length,
          extracted_at: new Date().toISOString(),
          extractor: extractorUsed,
          source_was_audio: isAudioMime(file.type),
          ...extractionMeta,
          ...(courseId ? { course_id: courseId } : {}),
        },
      })
      .eq("id", ingestionId)

    return NextResponse.json({
      ingestionId,
      status: "processing",
      extractedChars: rawText.length,
      extractor: extractorUsed,
    })
  } catch (err) {
    console.error("Ingestion upload error:", err)
    return NextResponse.json({ error: "Erro interno ao processar upload." }, { status: 500 })
  }
}
