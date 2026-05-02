import { courseDesignerCrudLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { evaluateNeuroscienceRules } from "@eximia/course-designer"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ blueprintId: string }>
}

/**
 * GET /api/course-designer/blueprints/[blueprintId]
 * Returns full blueprint with modules, objectives, assessments, and quality scorecard.
 */
export async function GET(request: Request, context: RouteContext) {
  const { blueprintId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const { data: blueprint, error } = await supabase
    .from("course_blueprints")
    .select("*")
    .eq("id", blueprintId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error || !blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  // Fetch related data
  const [modulesResult, objectivesResult, assessmentsResult] = await Promise.all([
    supabase
      .from("blueprint_modules")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("order", { ascending: true }),
    supabase
      .from("blueprint_objectives")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("module_number", { ascending: true }),
    supabase
      .from("blueprint_assessments")
      .select("*")
      .eq("blueprint_id", blueprintId),
  ])

  return NextResponse.json({
    ...blueprint,
    modules: modulesResult.data ?? [],
    objectives: objectivesResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
  })
}

/**
 * PUT /api/course-designer/blueprints/[blueprintId]
 * Edit a draft blueprint. Accepts partial updates to modules.
 */
export async function PUT(request: Request, context: RouteContext) {
  const { blueprintId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  if (courseDesignerCrudLimiter) {
    const { success } = await courseDesignerCrudLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  }

  // Verify blueprint exists and is draft
  const { data: blueprint, error: fetchError } = await supabase
    .from("course_blueprints")
    .select("id, status, quality_score")
    .eq("id", blueprintId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (fetchError || !blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  if (blueprint.status !== "draft") {
    return NextResponse.json(
      { error: "Apenas blueprints com status draft podem ser editados" },
      { status: 400 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body inválido" }, { status: 400 })
  }

  try {
    // Update blueprint-level fields
    const allowedFields = [
      "primary_framework",
      "interaction_strategy",
      "audience_profile",
      "evaluation_plan",
      "blueprint_data",
    ]
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { error: updateError } = await supabase
      .from("course_blueprints")
      .update(updateData)
      .eq("id", blueprintId)

    if (updateError) {
      throw updateError
    }

    // Update modules if provided (whitelist fields to prevent injection)
    if (Array.isArray(body.modules)) {
      const allowedModuleFields = [
        "title",
        "description",
        "duration_minutes",
        "spiral_level",
        "interaction_type",
        "framework_stages",
        "problema_motor",
        "cognitive_load",
        "chunks",
        "rubrics",
      ]
      for (const mod of body.modules as Array<Record<string, unknown>>) {
        if (!mod.id || typeof mod.id !== "string") continue
        const moduleUpdate: Record<string, unknown> = {}
        for (const field of allowedModuleFields) {
          if (mod[field] !== undefined) {
            moduleUpdate[field] = mod[field]
          }
        }
        if (Object.keys(moduleUpdate).length === 0) continue
        await supabase
          .from("blueprint_modules")
          .update(moduleUpdate)
          .eq("id", mod.id)
          .eq("blueprint_id", blueprintId)
      }
    }

    // Recalculate Quality Scorecard after edits (AC3)
    const previousScore = blueprint.quality_score
    let newScore = previousScore
    let neuroscienceScore: number | null = null
    let frameworkScore: number | null = null
    let verdict: string | null = null

    // Fetch phase_results from the latest completed generation job
    const { data: job } = await supabase
      .from("blueprint_generation_jobs")
      .select("phase_results")
      .eq("blueprint_id", blueprintId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single()

    if (job?.phase_results?.architect && job?.phase_results?.calculator) {
      // Recalculate neuroscience score (100% local, no LLM)
      const neuroResult = evaluateNeuroscienceRules(
        job.phase_results.architect,
        job.phase_results.calculator,
      )
      neuroscienceScore = neuroResult.total

      // Keep framework_score from last full evaluation
      frameworkScore = job.phase_results.validator?.framework_score?.total ?? null

      if (frameworkScore !== null) {
        newScore = Math.round(frameworkScore * 0.7 + neuroscienceScore * 0.3)
        verdict =
          newScore >= 90
            ? "approved"
            : newScore >= 70
              ? "approved"
              : "needs_review"

        // Persist recalculated scores
        await supabase
          .from("course_blueprints")
          .update({
            quality_score: newScore,
            neuroscience_score: neuroscienceScore,
            quality_verdict: verdict,
          })
          .eq("id", blueprintId)
      }
    }

    return NextResponse.json({
      success: true,
      previous_score: previousScore,
      new_score: newScore,
      neuroscience_score: neuroscienceScore,
      framework_score: frameworkScore,
      delta: newScore != null && previousScore != null ? newScore - previousScore : null,
      verdict,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { blueprint_id: blueprintId, route: "blueprint-update" },
    })
    console.error("Failed to update blueprint:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

/**
 * DELETE /api/course-designer/blueprints/[blueprintId]
 * Delete a draft blueprint (cascades to modules, objectives, assessments).
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { blueprintId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Verify blueprint exists and is draft
  const { data: blueprint } = await supabase
    .from("course_blueprints")
    .select("id, status")
    .eq("id", blueprintId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  if (blueprint.status !== "draft") {
    return NextResponse.json(
      { error: "Apenas blueprints com status draft podem ser deletados" },
      { status: 400 },
    )
  }

  // CASCADE delete (modules, objectives, assessments follow via FK)
  const { error: deleteError } = await supabase
    .from("course_blueprints")
    .delete()
    .eq("id", blueprintId)

  if (deleteError) {
    console.error("Failed to delete blueprint:", deleteError.message)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
