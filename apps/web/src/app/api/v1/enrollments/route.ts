import { getV1Context, paginatedResponse, requireScope, unauthorizedResponse } from "@/lib/api-auth"
import { enrollmentFiltersSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const parsed = enrollmentFiltersSchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { limit, cursor, status, course_id, student_id } = parsed.data

  let query = ctx.serviceClient
    .from("enrollments")
    .select("id, student_id, course_id, status, progress, created_at, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) query = query.lt("id", cursor)
  if (status) query = query.eq("status", status)
  if (course_id) query = query.eq("course_id", course_id)
  if (student_id) query = query.eq("student_id", student_id)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return paginatedResponse(data ?? [], limit)
}

/**
 * POST /api/v1/enrollments — Create a new enrollment
 * Required scope: enrollments:write
 * Body: { student_id: string, course_id: string, area_id?: string }
 */
export async function POST(request: Request) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  if (!requireScope(ctx.scopes, "enrollments:write")) {
    return NextResponse.json({ error: "Missing scope: enrollments:write" }, { status: 403 })
  }

  let body: { student_id?: string; course_id?: string; area_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { student_id, course_id, area_id } = body

  if (!student_id || !course_id) {
    return NextResponse.json(
      { error: "student_id and course_id are required" },
      { status: 400 }
    )
  }

  // Verify student belongs to this tenant
  const { data: student } = await ctx.serviceClient
    .from("users")
    .select("id")
    .eq("id", student_id)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!student) {
    return NextResponse.json({ error: "Student not found in tenant" }, { status: 404 })
  }

  // Verify course belongs to this tenant
  const { data: course } = await ctx.serviceClient
    .from("courses")
    .select("id")
    .eq("id", course_id)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!course) {
    return NextResponse.json({ error: "Course not found in tenant" }, { status: 404 })
  }

  // Check for existing enrollment
  const { data: existing } = await ctx.serviceClient
    .from("enrollments")
    .select("id, status")
    .eq("student_id", student_id)
    .eq("course_id", course_id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: "Enrollment already exists", enrollment_id: existing.id, status: existing.status },
      { status: 409 }
    )
  }

  // Create enrollment
  const { data: enrollment, error } = await ctx.serviceClient
    .from("enrollments")
    .insert({
      student_id,
      course_id,
      tenant_id: ctx.tenantId,
      area_id: area_id ?? null,
      status: "active",
    })
    .select("id, student_id, course_id, status, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ enrollment }, { status: 201 })
}
