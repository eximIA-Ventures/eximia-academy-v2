import { courseDesignerCrudLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/course-designer/blueprints
 * List blueprints for the authenticated user's tenant.
 * Filters: status, primary_framework
 * Pagination: cursor-based (cursor = last blueprint id)
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const framework = searchParams.get("primary_framework")
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50)

  let query = supabase
    .from("course_blueprints")
    .select(
      "id, course_id, status, primary_framework, framework, quality_score, neuroscience_score, quality_verdict, version, created_at, updated_at",
    )
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq("status", status)
  }
  if (framework) {
    query = query.eq("primary_framework", framework)
  }
  if (cursor) {
    query = query.lt("id", cursor)
  }

  const { data: blueprints, error } = await query

  if (error) {
    console.error("Failed to list blueprints:", error.message)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }

  const nextCursor =
    blueprints && blueprints.length === limit
      ? blueprints[blueprints.length - 1].id
      : null

  return NextResponse.json({ blueprints: blueprints ?? [], nextCursor })
}
