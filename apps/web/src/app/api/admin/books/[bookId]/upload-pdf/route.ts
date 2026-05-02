import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractPdfStructured, extractPdfText } from "@/lib/extractors/pdf-extractor"
import { cleanPdfContent, type CleanedPdf } from "@/lib/extractors/pdf-cleaner"
import { organizeContent } from "@eximia/agents"
import { NextResponse, after } from "next/server"

export const maxDuration = 300

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role))
    return { user, profile: null }

  return { user, profile }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { bookId } = await params

  // Validate the book belongs to this tenant
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, description")
    .eq("id", bookId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (bookError || !book) {
    return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 })
  }

  // Parse FormData
  const formData = await request.formData()
  const file = formData.get("file")
  const replaceExisting = formData.get("replaceExisting") === "true"

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo PDF obrigatório" }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Apenas arquivos PDF são aceitos" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo deve ter no máximo 20MB" }, { status: 400 })
  }

  const tenantId = profile.tenant_id
  const serviceClient = createServiceClient()

  try {
    // 1. Set status to uploading
    await serviceClient
      .from("books")
      .update({ processing_status: "uploading", processing_error: null })
      .eq("id", bookId)

    // 2. Upload PDF to storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const storagePath = `${tenantId}/books/${bookId}/book.pdf`
    await serviceClient.storage
      .from("books")
      .upload(storagePath, buffer, { cacheControl: "3600", upsert: true, contentType: "application/pdf" })

    // 3. Extract structured PDF (pages + outline)
    await serviceClient
      .from("books")
      .update({ processing_status: "extracting" })
      .eq("id", bookId)

    let cleaned: CleanedPdf
    try {
      const extraction = await extractPdfStructured(buffer)
      cleaned = cleanPdfContent(extraction)
    } catch (extractErr) {
      // Fallback: if structured extraction fails (pdfjs worker issues),
      // use legacy flat text extraction with no chapter detection
      console.error("[upload-pdf] Structured extraction failed, using fallback:", extractErr)
      const rawText = await extractPdfText(buffer)
      cleaned = {
        chapters: [],
        cleanText: rawText,
        stats: { totalPages: 0, contentPages: 0, boilerplatePages: 0, tocPages: 0, chaptersDetected: 0, outlineUsed: false },
      }
    }

    // 4. Set organizing + schedule background work
    await serviceClient
      .from("books")
      .update({ processing_status: "organizing" })
      .eq("id", bookId)

    // Delete existing chapters if replacing
    if (replaceExisting) {
      await serviceClient
        .from("book_chapters")
        .delete()
        .eq("book_id", bookId)
        .eq("tenant_id", tenantId)
    }

    // Extract primitives to avoid capturing File/Buffer objects in the closure
    const fileName = file.name

    // 6. Background: organize + insert chapters
    after(async () => {
      try {
        let chaptersToInsert: Array<{
          book_id: string
          tenant_id: string
          title: string
          content: string
          content_type: "chapter"
          chapter_order: number
        }>
        let suggestedDescription: string | undefined

        if (cleaned.chapters.length >= 2) {
          // ── Path A: Chapters pre-detected from PDF structure ──
          // Insert directly — avoids organizer chunking which doubles chapters
          chaptersToInsert = cleaned.chapters.map((ch, i) => ({
            book_id: bookId,
            tenant_id: tenantId,
            title: ch.title,
            content: ch.content,
            content_type: "chapter" as const,
            chapter_order: i,
          }))
        } else {
          // ── Path B: No chapters detected — send clean text to organizer ──
          const result = await organizeContent(
            {
              raw_text: cleaned.cleanText,
              source_type: "pdf",
              source_filename: fileName,
              language: "pt-br",
              max_chapters: 30,
            },
            { timeoutMs: 180_000 },
          )

          chaptersToInsert = result.chapters.map((ch) => ({
            book_id: bookId,
            tenant_id: tenantId,
            title: ch.title,
            content: ch.content,
            content_type: "chapter" as const,
            chapter_order: ch.order,
          }))
          suggestedDescription = result.suggested_description
        }

        // Insert chapters
        const { error: insertError } = await serviceClient
          .from("book_chapters")
          .insert(chaptersToInsert)

        if (insertError) {
          throw new Error(`Erro ao inserir capítulos: ${insertError.message}`)
        }

        // Update book metadata
        const updateData: Record<string, string> = {
          processing_status: "completed",
          updated_at: new Date().toISOString(),
        }
        if (!book.description && suggestedDescription) {
          updateData.description = suggestedDescription
        }

        await serviceClient.from("books").update(updateData).eq("id", bookId)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao processar PDF"
        await serviceClient
          .from("books")
          .update({ processing_status: "failed", processing_error: message })
          .eq("id", bookId)
      }
    })

    return NextResponse.json({
      status: "organizing",
      stats: cleaned.stats,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar PDF"
    await serviceClient
      .from("books")
      .update({ processing_status: "failed", processing_error: message })
      .eq("id", bookId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
