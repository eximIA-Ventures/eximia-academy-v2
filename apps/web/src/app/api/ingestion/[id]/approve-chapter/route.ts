import { generateQuestionsForChapter } from "@/lib/generate-questions-for-chapter"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { ingestionApprovalLimiter } from "@/lib/rate-limit"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveChapterSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(50),
  learning_objective: z.string().min(10),
  key_concepts: z.array(z.string()).optional(),
  estimated_reading_time_min: z.number().min(1).optional(),
})

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

    // Rate limiting
    if (ingestionApprovalLimiter) {
      const { success } = await ingestionApprovalLimiter.limit(user.id)
      if (!success) {
        return NextResponse.json(
          { error: "Muitas solicitacoes de aprovacao. Aguarde alguns minutos." },
          { status: 429 },
        )
      }
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

    // Fetch ingestion
    const { data: ingestion } = await serviceClient
      .from("content_ingestions")
      .select("id, status, tenant_id, course_id, ai_output, source_type, source_url")
      .eq("id", ingestionId)
      .eq("tenant_id", profile.tenant_id)
      .single()

    if (!ingestion) {
      return NextResponse.json({ error: "Ingestao não encontrada." }, { status: 404 })
    }

    if (ingestion.status !== "review") {
      return NextResponse.json(
        { error: `Ingestao nao esta em revisao. Status atual: ${ingestion.status}` },
        { status: 400 },
      )
    }

    if (!ingestion.course_id) {
      return NextResponse.json(
        { error: "Esta ingestao nao esta associada a um curso." },
        { status: 400 },
      )
    }

    // Parse edited data
    const body = await request.json()
    const parsed = approveChapterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: `Dados inválidos: ${parsed.error.errors[0].message}` },
        { status: 400 },
      )
    }

    const { title, content, learning_objective, key_concepts, estimated_reading_time_min } =
      parsed.data

    // Extract source media info from ingestion
    const sourceUrl = ingestion.source_type === "video_url" ? ingestion.source_url : null

    // Helper function to create chapter with retry on uniqueness violation
    // This handles the race condition where concurrent requests might calculate the same order
    const createChapterWithRetry = async (maxAttempts = 3): Promise<{ id: string } | null> => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Calculate next order (max + 1) — fresh calculation on each attempt
        const { data: lastChapter } = await serviceClient
          .from("chapters")
          .select("order")
          .eq("course_id", ingestion.course_id)
          .order("order", { ascending: false })
          .limit(1)
          .maybeSingle()

        const nextOrder = lastChapter ? lastChapter.order + 1 : 0

        // Attempt to insert chapter
        const { data: chapterResult, error: chapterError } = await serviceClient
          .from("chapters")
          .insert({
            course_id: ingestion.course_id,
            tenant_id: ingestion.tenant_id,
            created_by: user.id,
            title,
            content,
            learning_objective,
            key_concepts: key_concepts ?? null,
            estimated_reading_time_min: estimated_reading_time_min ?? null,
            video_url: sourceUrl,
            order: nextOrder,
            status: "draft",
          })
          .select("id")
          .single()

        // Success case
        if (!chapterError && chapterResult) {
          return chapterResult
        }

        // Check if error is due to unique constraint violation
        const isUniqueViolation =
          chapterError?.code === "23505" || // PostgreSQL unique constraint violation
          chapterError?.message?.includes("chapters_course_order_unique")

        if (isUniqueViolation && attempt < maxAttempts) {
          // Exponential backoff: 50ms, 100ms, etc.
          const delayMs = 50 * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue // Retry
        }

        // Non-retryable error or max attempts reached
        console.error(`Error creating chapter (attempt ${attempt}/${maxAttempts}):`, chapterError)
        return null
      }

      return null
    }

    const chapter = await createChapterWithRetry()
    if (!chapter) {
      return NextResponse.json({ error: "Erro ao criar capítulo." }, { status: 500 })
    }

    // Update ingestion to approved
    await serviceClient
      .from("content_ingestions")
      .update({
        status: "approved",
        ai_output: { ...parsed.data, approved_at: new Date().toISOString() },
      })
      .eq("id", ingestionId)

    // Auto-generate questions for the new chapter
    if (content && content.length >= 100) {
      generateQuestionsForChapter({
        chapterId: chapter.id,
        title,
        content,
        learningObjective: learning_objective,
        tenantId: ingestion.tenant_id,
      }).catch((err) => {
        console.error("Auto question generation on approve-chapter failed:", err)
      })
    }

    revalidatePath(`/courses/${ingestion.course_id}`)

    return NextResponse.json({
      chapterId: chapter.id,
      courseId: ingestion.course_id,
    })
  } catch (err) {
    console.error("Ingestion approve-chapter error:", err)
    return NextResponse.json({ error: "Erro interno ao criar capítulo." }, { status: 500 })
  }
}
