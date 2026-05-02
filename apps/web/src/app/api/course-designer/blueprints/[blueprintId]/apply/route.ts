import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  applyBlueprint,
  type BlueprintModule,
  type ApplyBlueprintInput,
  type ApplyBlueprintResult,
  getModelWithFallback,
} from "@eximia/agents"

interface RouteContext {
  params: Promise<{ blueprintId: string }>
}

/**
 * POST /api/course-designer/blueprints/[blueprintId]/apply
 * Apply Blueprint → create course + chapters + questions (D12)
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const { blueprintId } = await ctx.params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // Role check (manager or admin)
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Fetch blueprint
  const { data: blueprint, error: bpError } = await supabase
    .from("course_blueprints")
    .select("*")
    .eq("id", blueprintId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (bpError || !blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  if (!["draft", "approved"].includes(blueprint.status)) {
    return NextResponse.json(
      { error: `Blueprint status "${blueprint.status}" não pode ser aplicado` },
      { status: 400 },
    )
  }

  // Fetch modules with objectives
  const [{ data: modules }, { data: objectives }] = await Promise.all([
    supabase
      .from("blueprint_modules")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("order", { ascending: true }),
    supabase
      .from("blueprint_objectives")
      .select("*")
      .eq("blueprint_id", blueprintId),
  ])

  if (!modules?.length) {
    return NextResponse.json(
      { error: "Blueprint não possui módulos" },
      { status: 400 },
    )
  }

  // Group objectives by module order
  const objectivesByModule = (objectives || []).reduce(
    (acc, obj) => {
      const num = obj.module_number
      if (!acc[num]) acc[num] = []
      acc[num].push({
        objectiveStatement: obj.objective_statement,
        bloomLevel: obj.bloom_level,
      })
      return acc
    },
    {} as Record<number, Array<{ objectiveStatement: string; bloomLevel: string }>>,
  )

  const blueprintData = blueprint.blueprint_data as Record<string, unknown> | null
  const courseTitle =
    (blueprintData?.course_title as string) || `Curso — ${blueprintId.slice(0, 8)}`

  const mappedModules: BlueprintModule[] = modules.map((m) => ({
    order: m.order,
    title: m.title,
    description: m.description,
    durationMinutes: m.duration_minutes,
    interactionType: m.interaction_type,
    bloomLevel: objectivesByModule[m.order]?.[0]?.bloomLevel || null,
    frameworkStages:
      (m.framework_stages as Array<{ stage: string; label?: string; durationMinutes?: number }>) || [],
    objectives: objectivesByModule[m.order] || [],
  }))

  const input: ApplyBlueprintInput = {
    blueprintId,
    courseTitle,
    courseDescription: (blueprintData?.business_goal as string) || null,
    primaryFramework: blueprint.primary_framework || blueprint.framework,
    interactionStrategy: blueprint.interaction_strategy,
    modules: mappedModules,
  }

  try {
    // Run AI generation (chapter content + questions)
    const model = getModelWithFallback({ agentRole: "mestre", tenantPlan: "standard" })
    const result: ApplyBlueprintResult = await applyBlueprint(input, model)

    // Atomic creation: course → chapters → questions
    // Step 1: Create course
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        title: courseTitle,
        description: input.courseDescription,
        tenant_id: blueprint.tenant_id,
        created_by: user.id,
        status: "draft",
        settings: {
          blueprint_id: blueprintId,
          primary_framework: input.primaryFramework,
          interactionConfig: result.interactionConfig,
        },
      })
      .select("id")
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: "Falha ao criar curso", details: courseError?.message },
        { status: 500 },
      )
    }

    // Step 2: Create chapters (with WS2 fields)
    const chapterInserts = result.chapters.map((ch) => ({
      course_id: course.id,
      tenant_id: blueprint.tenant_id,
      title: ch.title,
      content: ch.content,
      learning_objective: ch.learningObjective,
      order: ch.order,
      interaction_type: ch.interactionType,
      bloom_target: ch.bloomTarget,
      status: "draft",
    }))

    const { data: createdChapters, error: chapError } = await supabase
      .from("chapters")
      .insert(chapterInserts)
      .select("id, order")

    if (chapError || !createdChapters) {
      // Rollback: delete course (scoped to tenant for safety)
      await supabase.from("courses").delete().eq("id", course.id).eq("tenant_id", blueprint.tenant_id)
      return NextResponse.json(
        { error: "Falha ao criar capítulos", details: chapError?.message },
        { status: 500 },
      )
    }

    // Step 3: Create questions (all with status=pending)
    const chapterIdByOrder = new Map(
      createdChapters.map((c) => [c.order, c.id]),
    )

    const questionInserts = result.questions.map((q) => ({
      chapter_id: chapterIdByOrder.get(q.chapterOrder)!,
      tenant_id: blueprint.tenant_id,
      text: q.text,
      skill: q.skill,
      intention: q.intention,
      expected_depth: q.expectedDepth,
      status: "pending" as const,
    }))

    const { error: qError } = await supabase
      .from("questions")
      .insert(questionInserts)

    if (qError) {
      // Rollback: delete chapters + course (scoped to tenant for safety)
      await supabase.from("chapters").delete().eq("course_id", course.id).eq("tenant_id", blueprint.tenant_id)
      await supabase.from("courses").delete().eq("id", course.id).eq("tenant_id", blueprint.tenant_id)
      return NextResponse.json(
        { error: "Falha ao criar perguntas", details: qError.message },
        { status: 500 },
      )
    }

    // Step 4: Update blueprint status to "applied"
    await supabase
      .from("course_blueprints")
      .update({
        status: "applied",
        applied_to_course: true,
        applied_at: new Date().toISOString(),
      })
      .eq("id", blueprintId)

    return NextResponse.json({
      success: true,
      courseId: course.id,
      chaptersCreated: createdChapters.length,
      questionsCreated: questionInserts.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Falha ao aplicar blueprint", details: (err as Error).message },
      { status: 500 },
    )
  }
}
