import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  extractSlidesFromPdf,
  extractSlidesFromPptx,
  processImageAsSlide,
} from "@/lib/extractors/slide-splitter"
import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params

  // Auth + role check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "manager", "instructor"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = profile.tenant_id as string

  // Verify chapter belongs to tenant
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, tenant_id")
    .eq("id", chapterId)
    .single()

  if (!chapter || chapter.tenant_id !== tenantId)
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]

  if (!files.length)
    return NextResponse.json({ error: "No files provided" }, { status: 400 })

  // Validate files
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json(
        { error: `File ${file.name} exceeds 100MB limit` },
        { status: 400 },
      )
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      )
  }

  const service = createServiceClient()
  const storagePath = `${tenantId}/${chapterId}/slides`

  // Delete existing slides for this chapter (fresh upload replaces all)
  await service.from("chapter_slides").delete().eq("chapter_id", chapterId)

  const createdSlides: Array<{
    order: number
    image_url: string
    image_storage_path: string
    metadata: Record<string, unknown>
  }> = []

  try {
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())

      if (file.type === "application/pdf") {
        // PDF: store original PDF, create slides with page references
        const { pageCount, pdfBuffer } = await extractSlidesFromPdf(buffer, file.name)

        // Upload original PDF
        const pdfPath = `${storagePath}/source.pdf`
        await service.storage
          .from("chapter-assets")
          .upload(pdfPath, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
          })

        const {
          data: { publicUrl: pdfUrl },
        } = service.storage.from("chapter-assets").getPublicUrl(pdfPath)

        // Store slide_audio_url placeholder — will be set later
        // Create one slide per page
        for (let page = 1; page <= pageCount; page++) {
          createdSlides.push({
            order: page - 1,
            image_url: pdfUrl,
            image_storage_path: pdfPath,
            metadata: { type: "pdf", pdfUrl, pageNumber: page, totalPages: pageCount },
          })
        }
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        // PPTX: extract images
        const slides = await extractSlidesFromPptx(buffer)

        for (const slide of slides) {
          const fileName = `${slide.order}.${slide.imageExt}`
          const filePath = `${storagePath}/${fileName}`

          await service.storage
            .from("chapter-assets")
            .upload(filePath, slide.imageBuffer, {
              contentType: slide.imageMime,
              upsert: true,
            })

          const {
            data: { publicUrl },
          } = service.storage.from("chapter-assets").getPublicUrl(filePath)

          createdSlides.push({
            order: createdSlides.length,
            image_url: publicUrl,
            image_storage_path: filePath,
            metadata: { type: "pptx" },
          })
        }
      } else {
        // Direct image
        const ext = file.name.split(".").pop() ?? "png"
        const fileName = `${createdSlides.length}.${ext}`
        const filePath = `${storagePath}/${fileName}`

        await service.storage
          .from("chapter-assets")
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true,
          })

        const {
          data: { publicUrl },
        } = service.storage.from("chapter-assets").getPublicUrl(filePath)

        createdSlides.push({
          order: createdSlides.length,
          image_url: publicUrl,
          image_storage_path: filePath,
          metadata: { type: "image" },
        })
      }
    }

    // Insert all slides into DB
    const { error: insertError } = await service.from("chapter_slides").insert(
      createdSlides.map((slide) => ({
        chapter_id: chapterId,
        tenant_id: tenantId,
        order: slide.order,
        image_url: slide.image_url,
        image_storage_path: slide.image_storage_path,
        text_content: null,
        text_status: "pending",
        metadata: slide.metadata,
      })),
    )

    if (insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      slideCount: createdSlides.length,
      slides: createdSlides.map((s) => ({
        order: s.order,
        image_url: s.image_url,
        metadata: s.metadata,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
