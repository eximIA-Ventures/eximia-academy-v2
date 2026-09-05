import { PAPEIS_COURSE_DESIGNER, requireRole } from "@/lib/api-role-guard"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ blueprintId: string }>
}

/**
 * GET /api/course-designer/blueprints/[blueprintId]/export
 * Returns full blueprint as JSON download.
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

  const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_COURSE_DESIGNER)
  if (recusa) return recusa

  const { data: blueprint } = await supabase
    .from("course_blueprints")
    .select("*")
    .eq("id", blueprintId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  const [modulesResult, objectivesResult, assessmentsResult] = await Promise.all([
    supabase
      .from("blueprint_modules")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("order", { ascending: true }),
    supabase
      .from("blueprint_objectives")
      .select("*")
      .eq("blueprint_id", blueprintId),
    supabase
      .from("blueprint_assessments")
      .select("*")
      .eq("blueprint_id", blueprintId),
  ])

  const exportData = {
    ...blueprint,
    modules: modulesResult.data ?? [],
    objectives: objectivesResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
    exported_at: new Date().toISOString(),
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="blueprint-${blueprintId}.json"`,
    },
  })
}
