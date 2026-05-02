import { startBatchGeneration } from "@/lib/question-generation"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  chapters: z
    .array(
      z.object({
        title: z.string().min(3),
        content: z.string().min(50),
        learning_objective: z.string().min(10),
        order: z.number().int().min(0),
        key_concepts: z.array(z.string()),
        estimated_reading_time_min: z.number().min(1),
      }),
    )
    .min(1),
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
      .select("id, status, tenant_id, ai_output")
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

    // Parse edited data from manager
    const body = await request.json()
    const parsed = approveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: `Dados inválidos: ${parsed.error.errors[0].message}` },
        { status: 400 },
      )
    }

    const { title, description, chapters } = parsed.data

    // Fetch manager's area_id so the course appears in their filtered list
    const { data: userAreas } = await serviceClient
      .from("user_areas")
      .select("area_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
    const areaId = userAreas?.area_id ?? undefined

    // Create course
    const { data: course, error: courseError } = await serviceClient
      .from("courses")
      .insert({
        title,
        description,
        tenant_id: ingestion.tenant_id,
        created_by: user.id,
        status: "draft",
        type: "regular",
        ...(areaId ? { area_id: areaId } : {}),
      })
      .select("id")
      .single()

    if (courseError || !course) {
      console.error("Error creating course:", courseError)
      return NextResponse.json({ error: "Erro ao criar curso." }, { status: 500 })
    }

    // Create chapters in batch (published so question generation runs)
    const chaptersToInsert = chapters.map((ch) => ({
      course_id: course.id,
      tenant_id: ingestion.tenant_id,
      created_by: user.id,
      title: ch.title,
      content: ch.content,
      learning_objective: ch.learning_objective,
      order: ch.order,
      key_concepts: ch.key_concepts,
      estimated_reading_time_min: ch.estimated_reading_time_min,
      status: "published" as const,
    }))

    const { data: savedChapters, error: chaptersError } = await serviceClient
      .from("chapters")
      .insert(chaptersToInsert)
      .select("id")

    if (chaptersError) {
      console.error("Error creating chapters:", chaptersError)
      // Cleanup: delete the course since chapters failed (scoped to tenant for safety)
      await serviceClient.from("courses").delete().eq("id", course.id).eq("tenant_id", ingestion.tenant_id)
      return NextResponse.json({ error: "Erro ao criar capítulos." }, { status: 500 })
    }

    // Update ingestion to approved
    await serviceClient
      .from("content_ingestions")
      .update({
        course_id: course.id,
        status: "approved",
        ai_output: { ...body, approved_at: new Date().toISOString() },
      })
      .eq("id", ingestionId)

    // Auto-trigger batch question generation (fire-and-forget)
    startBatchGeneration({
      courseId: course.id,
      tenantId: ingestion.tenant_id,
      triggeredBy: user.id,
    }).catch((err) => {
      console.error("Auto-trigger question generation after ingestion failed:", err)
    })

    return NextResponse.json({
      courseId: course.id,
      chaptersCreated: savedChapters?.length ?? 0,
    })
  } catch (err) {
    console.error("Ingestion approve error:", err)
    return NextResponse.json({ error: "Erro interno ao criar curso." }, { status: 500 })
  }
}
