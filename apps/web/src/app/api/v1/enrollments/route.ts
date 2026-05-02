import { getV1Context, paginatedResponse, unauthorizedResponse } from "@/lib/api-auth"
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
